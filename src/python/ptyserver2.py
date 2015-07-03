#
#
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

def processPacket(byte_data):
    """
    byte_data - String of bytes containing JSON data in utf-8 encoding.
    """
    json_data = codecs.decode(byte_data, 'utf-8')
    sendToMaster(json_data)

def sendToMaster(data):
    print(data)
    sys.stdout.flush()

def log(msg):
    print(msg, file=sys.stderr)
    sys.stderr.flush()

###########################################################################
activity_event = threading.Event()
nbfr_counter = 0

class NonblockingFileReader:
    def __init__(self, file_object):
        global nbfr_counter
        
        self.file_object = file_object
        
        self.id = nbfr_counter
        nbfr_counter += 1
        
        self.buffer = []
        self.buffer_lock = threading.Lock()
        
        self.thread = threading.Thread(name="Nonblocking File Reader "+str(self.id),
            target=self._thread_start)
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

    def _thread_start(self):
        global activity_event
        while True:
            chunk = self._read_next()
            log("_thread_start read:" + repr(chunk))
            with self.buffer_lock:
                self.buffer.append(chunk)
            # Tick the alarm
            activity_event.set()
            
    def _read_next(self):
        return self.file_object.read(10240)

class NonblockingLineReader(NonblockingFileReader):
    def _read_next(self):
        return self.file_object.readline()

def WaitOnIOActivity():
    global activity_event
    activity_event.wait()
    activity_event.clear()

###########################################################################

def main():
    # command_buffer = ""
    log("pty server process starting up")
    stdin_reader = NonblockingFileReader(sys.stdin.buffer.raw)
    
    while True:
        WaitOnIOActivity()
        chunk = stdin_reader.read()
        while chunk is not None:
            log("Main <<< " + repr(chunk))
            chunk = stdin_reader.read()

        # sendToMaster("Pty Server waiting\n")
        # active_tup = select.select([sys.stdin.fileno()], [], [])
        # sendToMaster("server saw something move!" + repr(active_tup))
        # if sys.stdin.fileno() in active_tup[0]:
        #     sendToMaster("server trying to read")
        #     chunk = sys.stdin.readline(10240)
        #     #chunk = sys.stdin.buffer.read(4)   # read up to 10Kb raw bytes.
        #     sendToMaster("server reading: "+repr(chunk))
        #     #command_buffer = command_buffer + chunk

            #while len(command_buffer) >= 4:
            #    size = struct.unpack(">I", command_buffer[0:4])[0]
            #    sendToMaster("command size" + str(size))
            #    if len(command_buffer) >= size + 4:
            #        processPacket(command_buffer[4: size+4])
            #        command_buffer = command_buffer[size+4:]
            #    else:
            #        break
    #pty = ptyprocess.PtyProcess.spawn(['/bin/ls']) #cwd=, env=, dimensions=(24,80))
    #result = select([pty.fileno()], [], []);
    #if len(result[0]) != 0:
    #    incoming = pty.read()
#        print(incoming)

main()
