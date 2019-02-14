/**
 * Copyright (c) 2019, Microsoft Corporation (MIT License).
 */

#include <nan.h>
#include <windows.h>

static NAN_METHOD(ApiConsoleProcessList) {
  if (info.Length() != 1 ||
      !info[0]->IsNumber()) {
    Nan::ThrowError("Usage: getConsoleProcessList(shellPid)");
    return;
  }

  const SHORT pid = info[0]->Uint32Value();

  if (!FreeConsole()) {
    Nan::ThrowError("FreeConsole failed");
  }
  if (!AttachConsole(pid)) {
    Nan::ThrowError("AttachConsole failed");
  }
  auto processList = std::vector<DWORD>(64);
  auto processCount = GetConsoleProcessList(&processList[0], processList.size());
  if (processList.size() < processCount) {
      processList.resize(processCount);
      processCount = GetConsoleProcessList(&processList[0], processList.size());
  }
  FreeConsole();

  v8::Local<v8::Array> result = Nan::New<v8::Array>();
  for (DWORD i = 0; i < processCount; i++) {
    result->Set(i, Nan::New<v8::Number>(processList[i]));
  }
  info.GetReturnValue().Set(result);
}

extern "C" void init(v8::Handle<v8::Object> target) {
  Nan::HandleScope scope;
  Nan::SetMethod(target, "getConsoleProcessList", ApiConsoleProcessList);
};

NODE_MODULE(pty, init);
