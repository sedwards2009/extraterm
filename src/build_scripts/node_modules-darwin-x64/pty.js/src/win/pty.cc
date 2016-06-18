/**
* pty.js
* Copyright (c) 2013-2015, Christopher Jeffrey, Peter Sunde (MIT License)
*
* pty.cc:
*   This file is responsible for starting processes
*   with pseudo-terminal file descriptors.
*/

#include "nan.h"

#include <string.h>
#include <stdlib.h>
#include <winpty.h>
#include <Shlwapi.h> // PathCombine
#include <string>
#include <sstream>
#include <iostream>
#include <vector>

using namespace v8;
using namespace std;
using namespace node;

/**
* Misc
*/
extern "C" void init(Handle<Object>);

#define WINPTY_DBG_VARIABLE TEXT("WINPTYDBG")
#define MAX_ENV 65536

/**
* winpty
*/
static std::vector<winpty_t *> ptyHandles;
static volatile LONG ptyCounter;

struct winpty_s {
  winpty_s();
  HANDLE controlPipe;
  HANDLE dataPipe;
};

winpty_s::winpty_s() :
  controlPipe(nullptr),
  dataPipe(nullptr)
{
}

/**
* Helpers
*/

const wchar_t* to_wstring(const String::Utf8Value& str)
{
  const char *bytes = *str;
  unsigned int sizeOfStr = MultiByteToWideChar(CP_ACP, 0, bytes, -1, NULL, 0);
  wchar_t *output = new wchar_t[sizeOfStr];
  MultiByteToWideChar(CP_ACP, 0, bytes, -1, output, sizeOfStr);
  return output;
}

static winpty_t *get_pipe_handle(int handle) {
  for(size_t i = 0; i < ptyHandles.size(); ++i) {
    winpty_t *ptyHandle = ptyHandles[i];
    int current = (int)ptyHandle->controlPipe;
    if(current == handle) {
      return ptyHandle;
    }
  }
  return nullptr;
}

static bool remove_pipe_handle(int handle) {
  for(size_t i = 0; i < ptyHandles.size(); ++i) {
    winpty_t *ptyHandle = ptyHandles[i];
    if((int)ptyHandle->controlPipe == handle) {
      delete ptyHandle;
      ptyHandle = nullptr;
      return true;
    }
  }
  return false;
}

static bool file_exists(std::wstring filename) {
  DWORD attr = ::GetFileAttributesW(filename.c_str());
  if(attr == INVALID_FILE_ATTRIBUTES || (attr & FILE_ATTRIBUTE_DIRECTORY)) {
    return false;
  }
  return true;
}

// cmd.exe -> C:\Windows\system32\cmd.exe
static std::wstring get_shell_path(std::wstring filename)  {

  std::wstring shellpath;

  if(file_exists(filename)) {
    return shellpath;
  }

  wchar_t buffer_[MAX_ENV];
  int read = ::GetEnvironmentVariableW(L"Path", buffer_, MAX_ENV);
  if(!read) {
    return shellpath;
  }

  std::wstring delimiter = L";";
  size_t pos = 0;
  vector<wstring> paths;
  std::wstring buffer(buffer_);
  while ((pos = buffer.find(delimiter)) != std::wstring::npos) {
    paths.push_back(buffer.substr(0, pos));
    buffer.erase(0, pos + delimiter.length());
  }

  const wchar_t *filename_ = filename.c_str();

  for (int i = 0; i < paths.size(); ++i) {
    wstring path = paths[i];
    wchar_t searchPath[MAX_PATH];
    ::PathCombineW(searchPath, const_cast<wchar_t*>(path.c_str()), filename_);

    if(searchPath == NULL) {
      continue;
    }

    if(file_exists(searchPath)) {
      shellpath = searchPath;
      break;
    }

  }

  return shellpath;
}

/*
* PtyOpen
* pty.open(dataPipe, cols, rows)
*
* If you need to debug winpty-agent.exe do the following:
* ======================================================
*
* 1) Install python 2.7
* 2) Install win32pipe
x86) http://sourceforge.net/projects/pywin32/files/pywin32/Build%20218/pywin32-218.win32-py2.7.exe/download
x64) http://sourceforge.net/projects/pywin32/files/pywin32/Build%20218/pywin32-218.win-amd64-py2.7.exe/download
* 3) Start deps/winpty/misc/DebugServer.py (Before you start node)
*
* Then you'll see output from winpty-agent.exe.
*
* Important part:
* ===============
* CreateProcess: success 8896 0 (Windows error code)
*
* Create test.js:
* ===============
*
* var pty = require('./');
*
* var term = pty.fork('cmd.exe', [], {
*   name: 'Windows Shell',
*	  cols: 80,
*	  rows: 30,
*	  cwd: process.env.HOME,
*	  env: process.env,
*	  debug: true
* });
*
* term.on('data', function(data) {
* 	console.log(data);
* });
*
*/

static NAN_METHOD(PtyOpen) {
  NanScope();

  if (args.Length() != 4
    || !args[0]->IsString() // dataPipe
    || !args[1]->IsNumber() // cols
    || !args[2]->IsNumber() // rows
    || !args[3]->IsBoolean()) // debug
  {
    return NanThrowError("Usage: pty.open(dataPipe, cols, rows, debug)");
  }

  std::wstring pipeName = to_wstring(String::Utf8Value(args[0]->ToString()));
  int cols = args[1]->Int32Value();
  int rows = args[2]->Int32Value();
  bool debug = args[3]->ToBoolean()->IsTrue();

  // Enable/disable debugging
  SetEnvironmentVariable(WINPTY_DBG_VARIABLE, debug ? "1" : NULL); // NULL = deletes variable

  // Open a new pty session.
  winpty_t *pc = winpty_open_use_own_datapipe(pipeName.c_str(), cols, rows);

  // Error occured during startup of agent process.
  assert(pc != nullptr);

  // Save pty struct fpr later use.
  ptyHandles.insert(ptyHandles.end(), pc);

  // Pty object values.
  Local<Object> marshal = NanNew<Object>();
  marshal->Set(NanNew<String>("pid"), NanNew<Number>((int)pc->controlPipe));
  marshal->Set(NanNew<String>("pty"), NanNew<Number>(InterlockedIncrement(&ptyCounter)));
  marshal->Set(NanNew<String>("fd"), NanNew<Number>(-1));

  NanReturnValue(marshal);
}

/*
* PtyStartProcess
* pty.startProcess(pid, file, env, cwd);
*/

static NAN_METHOD(PtyStartProcess) {
  NanScope();

  if (args.Length() != 5
    || !args[0]->IsNumber() // pid
    || !args[1]->IsString() // file
    || !args[2]->IsString() // cmdline
    || !args[3]->IsArray() // env
    || !args[4]->IsString()) // cwd
  {
    return NanThrowError(
        "Usage: pty.startProcess(pid, file, cmdline, env, cwd)");
  }

  Handle<Value> exception;
  std::stringstream why;

  // Get winpty_t by control pipe handle
  int pid = args[0]->Int32Value();
  winpty_t *pc = get_pipe_handle(pid);
  assert(pc != nullptr);

  const wchar_t *filename = to_wstring(String::Utf8Value(args[1]->ToString()));
  const wchar_t *cmdline = to_wstring(String::Utf8Value(args[2]->ToString()));
  const wchar_t *cwd = to_wstring(String::Utf8Value(args[4]->ToString()));

  // create environment block
  wchar_t *env = NULL;
  const Handle<Array> envValues = Handle<Array>::Cast(args[3]);
  if(!envValues.IsEmpty()) {

    std::wstringstream envBlock;

    for(uint32_t i = 0; i < envValues->Length(); i++) {
      std::wstring envValue(to_wstring(String::Utf8Value(envValues->Get(i)->ToString())));
      envBlock << envValue << L' ';
    }

    std::wstring output = envBlock.str();

    size_t count = output.size();
    env = new wchar_t[count + 2];
    wcsncpy(env, output.c_str(), count);

    wcscat(env, L"\0");
  }

  // use environment 'Path' variable to determine location of
  // the relative path that we have recieved (e.g cmd.exe)
  std::wstring shellpath;
  if(::PathIsRelativeW(filename)) {
    shellpath = get_shell_path(filename);
  } else {
    shellpath = filename;
  }

  std::string shellpath_(shellpath.begin(), shellpath.end());

  if(shellpath.empty() || !file_exists(shellpath)) {
    goto invalid_filename;
  }

  goto open;

open:
   int result = winpty_start_process(pc, shellpath.c_str(), cmdline, cwd, env);
   if(result != 0) {
      why << "Unable to start terminal process. Win32 error code: " << result;
      exception = NanThrowError(why.str().c_str());
   }
   goto cleanup;

invalid_filename:
   why << "File not found: " << shellpath_;
   exception = NanThrowError(why.str().c_str());
   goto cleanup;

cleanup:
  delete filename;
  delete cmdline;
  delete cwd;
  delete env;

  if(!exception.IsEmpty()) {
    return exception;
  }

  NanReturnUndefined();
}

/*
* PtyResize
* pty.resize(pid, cols, rows);
*/
static NAN_METHOD(PtyResize) {
  NanScope();

  if (args.Length() != 3
    || !args[0]->IsNumber() // pid
    || !args[1]->IsNumber() // cols
    || !args[2]->IsNumber()) // rows
  {
    return NanThrowError("Usage: pty.resize(pid, cols, rows)");
  }

  int handle = args[0]->Int32Value();
  int cols = args[1]->Int32Value();
  int rows = args[2]->Int32Value();

  winpty_t *pc = get_pipe_handle(handle);

  assert(pc != nullptr);
  assert(0 == winpty_set_size(pc, cols, rows));

  NanReturnUndefined();
}

/*
* PtyKill
* pty.kill(pid);
*/
static NAN_METHOD(PtyKill) {
  NanScope();

  if (args.Length() != 1
    || !args[0]->IsNumber()) // pid
  {
    return NanThrowError("Usage: pty.kill(pid)");
  }

  int handle = args[0]->Int32Value();

  winpty_t *pc = get_pipe_handle(handle);

  assert(pc != nullptr);
  winpty_exit(pc);
  assert(true == remove_pipe_handle(handle));

  NanReturnUndefined();
}

/**
* Init
*/

extern "C" void init(Handle<Object> target) {
  NanScope();
  NODE_SET_METHOD(target, "open", PtyOpen);
  NODE_SET_METHOD(target, "startProcess", PtyStartProcess);
  NODE_SET_METHOD(target, "resize", PtyResize);
  NODE_SET_METHOD(target, "kill", PtyKill);
};

NODE_MODULE(pty, init);
