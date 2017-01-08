#
# Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

import ptyprocess
import select
import sys
import struct
import fcntl
import os
import codecs
import array
import threading
import json
import subprocess

LOG_FINE = False
LOG_FINER = False
def log(msg):
    print(msg, file=sys.stderr)
    sys.stderr.flush()

###########################################################################
def processPacket(byte_data):
    """
    byte_data - String of bytes containing JSON data in utf-8 encoding.
    """
    json_data = codecs.decode(byte_data, 'utf-8')
    sendToMaster(json_data)

def sendToMaster(data):
    print(data)
    sys.stdout.flush()

###########################################################################
activity_event = threading.Event()
nbfr_counter = 0

class NonblockingFileReader:
    def __init__(self, file_object=None, read=None):
        global nbfr_counter
        
        self.file_object = file_object
        self._custom_read = read

        # These are used to throttle our reading and sending of data.
        self._read_valve = threading.Event()
        self._read_valve.clear()
        self._permit_data_size = 0

        self.id = nbfr_counter
        nbfr_counter += 1
        
        self._isEOF = False
        
        self.buffer = []
        self.buffer_lock = threading.RLock()
        
        self.thread = threading.Thread(name="Nonblocking File Reader "+str(self.id),
            target=self._thread_start)
        self.thread.daemon = True
        self.thread.start()

    def read(self):
        with self.buffer_lock:
            if len(self.buffer) != 0:
                chunk = self.buffer[0]
                del self.buffer[0]
                return chunk
            else:
                return None

    def isAvailable(self):
        with self.buffer_lock:
            return len(self.buffer) != 0

    def isEOF(self):
        with self.buffer_lock:
            return len(self.buffer)==0 and self._isEOF

    def permitDataSize(self, size):
        if LOG_FINER:
            log("NonblockingFileReader.permitDataSize(): Setting permit_data_size to " + str(size))
        with self.buffer_lock:
            self._permit_data_size = size
            if size > 0:
                self._read_valve.set()
            else:
                self._read_valve.clear()

    def _thread_start(self):
        global activity_event
        try:
            while True:
                self._read_valve.wait()

                chunk = self._read_next()
                if LOG_FINER:
                    log("NonblockingFileReader._thread_start() Read: " + repr(chunk))
                
                with self.buffer_lock:
                    self.buffer.append(chunk)
                    self.permitDataSize(self._permit_data_size - len(chunk))

                # Tick the alarm
                if LOG_FINER:
                    log("NonblockingFileReader._thread_start() Setting activity flag.")
                activity_event.set()
        except EOFError:
            self._isEOF = True
            if LOG_FINE:
                log("NonblockingFileReader got EOF, bye!")
            activity_event.set()
            
    def _read_next(self):
        if self._custom_read is not None:
            return self._custom_read(1024)
        else:
            return self.file_object.read(10240)

class NonblockingLineReader(NonblockingFileReader):
    def __init__(self, file_object=None, read=None):
        NonblockingFileReader.__init__(self, file_object=file_object, read=read)
        self._read_valve.set()

    def permitDataSize(self, size):
        pass

    def _read_next(self):
        return self.file_object.readline()

def WaitOnIOActivity():
    global activity_event
    if LOG_FINER:
        log("activity_event.wait()")
    activity_event.wait()
    if LOG_FINER:
        log("activity_event.clear()")
    activity_event.clear()

###########################################################################

pty_list = []   # List of dicts with structure {id: string, pty: pty, reader: }

#
#
# Create pty command (from Extraterm process):
# {
#   type: string = "create";
#   argv: string[];
#   rows: number;
#   columns: number;
#   env: {string: string};  // dict
# }
#
# Created message (to Extraterm process):
# {
#   type: string = "created";
#   id: string; // pty ID.
# }
#
#
# pty output message (to Extraterm process):
# {
#   type: string = "output";
#   id: number; // pty ID.
#   data: string;
# }
#
# pty closed message (to Extraterm process):
# {
#   type: string = "closed";
#   id: number; // pty ID.
# }
#
# write to pty message (from Extraterm process)
# {
#   type: string = "write";
#   id: number; // pty ID.
#   data: string;
# }
#
# resize message (from Extraterm process)
# {
#   type: string = "resize";
#   id: number; // pty ID.
#   rows: number;
#   columns: number;
# }
#
# terminate (from Extraterm process)
# {
#   type: string = "terminate";
# }
#
# permit data size
# {
#   type: string = "permit-data-size";
#   id: number; // pty ID.
#   size: number; // permitted number of characters to send.
# }

pty_counter = 1

def process_command(json_command):
    global pty_list
    global pty_counter
    
    if LOG_FINE:
        log("server process command:"+repr(json_command))
    cmd = json.loads(json_command)

    # Create new PTY
    if cmd["type"] == "create":
        # Create a new pty.
        rows = cmd["rows"]
        columns = cmd["columns"]
        env = cmd["env"]
        
        # Fix up the PATH variable on cygwin.
        if sys.platform == "cygwin":
            if "Path" in env and "PATH" not in env:
                env["PATH"] = env["Path"]
                del env["Path"]
            env["PATH"] = cygwin_convert_path_variable(env["PATH"])
                
        pty = ptyprocess.PtyProcess.spawn(cmd["argv"], dimensions=(rows, columns), env=env) #cwd=, )
        pty_reader = NonblockingFileReader(read=pty.read)
        pty_id = pty_counter
        pty_list.append( { "id": pty_id, "pty": pty, "reader": pty_reader } )
        pty_counter += 1
        
        send_to_controller({ "type": "created", "id": pty_id })
        return True
        
    # Write to PTY
    if cmd["type"] == "write":
        pty = find_pty_by_id(cmd["id"])
        if pty is None:
            log("Received a write command for an unknown pty (id=" + str(cmd["id"]) + "")
            return
        pty.write(cmd["data"].encode())
        return True

    # Resize PTY
    if cmd["type"] == "resize":
        pty = find_pty_by_id(cmd["id"])
        if pty is None:
            log("Received a resize command for an unknown pty (id=" + str(cmd["id"]) + "")
            return
        pty.setwinsize(cmd["rows"], cmd["columns"])
        return True

    # Set permitted data size
    if cmd["type"] == "permit-data-size":
        reader = find_reader_by_id(cmd["id"])
        if reader is None:
            log("Received a permit-data-size command for an unknown pty (id=" + str(cmd["id"]) + "")
            return
        reader.permitDataSize(cmd["size"])
        return True

    # Terminate a PTY
    if cmd["type"] == "terminate":
        for pty_tup in pty_list:
            pty_tup["pty"].terminate(True)
            pty_tup["reader"].permitDataSize(1024*1024*1024)
        return False
        
    log("ptyserver receive unrecognized message:" + json_command)
    return True
    
def send_to_controller(msg):
    msg_text = json.dumps(msg)+"\n"
    if LOG_FINE:
        log("server >>> main : "+msg_text)
    sys.stdout.write(msg_text)
    sys.stdout.flush()

def find_pty_by_id(pty_id):
    for pty_tup in pty_list:
        if pty_tup["id"] == pty_id:
            return pty_tup["pty"]
    return None

def find_reader_by_id(pty_id):
    for pty_tup in pty_list:
        if pty_tup["id"] == pty_id:
            return pty_tup["reader"]
    return None

def cygwin_convert_path_variable(path_var):
    return subprocess.check_output(["/usr/bin/cygpath", "-p", path_var])

def main():
    global pty_list
    running = True
    
    if LOG_FINE:
        log("pty server process starting up")
    stdin_reader = NonblockingLineReader(sys.stdin)
    
    while running:
        if LOG_FINER:
            log("pty server thread active count: " + str(threading.active_count()))
        WaitOnIOActivity()
        if LOG_FINER:
            log("Server awake")
        
        # Check the stdin control channel.
        if stdin_reader.isEOF():
            if LOG_FINE:
                log("server <<< main : EOF")
            running = False
            
        chunk = stdin_reader.read()
        while chunk is not None:
            if LOG_FINE:
                log("server <<< main : " + repr(chunk))
            running = False if not running or not process_command(chunk.strip()) else True
            if LOG_FINE:
                log("running: " + str(running))
            chunk = stdin_reader.read()
            
        # Check our ptys for output.
        for pty_struct in pty_list:
            pty_chunk = pty_struct["reader"].read()
            while pty_chunk is not None:
                if LOG_FINE:
                    log("server <<< pty : " + repr(pty_chunk))
                # Decode the chunk of bytes.
                data = pty_chunk.decode(errors='ignore')
                send_to_controller( {"type": "output", "id": pty_struct["id"], "data": data} )
                pty_chunk = pty_struct["reader"].read()

        # Check for exited ptys
        for pty_struct in pty_list[:]:
            if LOG_FINER:
                log("checking live pty: "+str(pty_struct["pty"].isalive()))
            if not pty_struct["pty"].isalive():
                pty_list = [ t for t in pty_list if t["id"] != pty_struct["id"] ]
                send_to_controller( {"type": "closed", "id": pty_struct["id"] } )

        if LOG_FINER:
            log("pty server active count: " + str(threading.active_count()))
            for t in threading.enumerate():
                log("Thread: " + t.name)

    sys.stdin.buffer.raw.close()
    if LOG_FINE:
        log("pty server main thread exiting.")
    sys.exit(0)
main()
