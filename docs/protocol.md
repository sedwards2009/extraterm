Protocol
========

This describes the escape codes and protocol understood by Extraterm. This is a non-standard extension.


General Form
------------

    ESC "&" [cookie] (";" [arg])* 0x07

[cookie] = 


Start HTML Mode
---------------

    ESC "&" [cookie] 0x07



Exit HTML Mode
--------------
When in HTML mode send a NUL character to exit.

    0x00

Mark Start Command
------------------

    ESC "&" [cookie] ";2;" [shell_name] 0x07 [command_line] 0x00

[shell_name] = The name of the shell involved, i.e. "bash"
[command_line] = The command line being invoked.


Mark End Command
----------------

    ESC "&" <cookie> ";3" 0x07 [return_code] 0x00

[return_code] = The numerical return code result from the last command.

Data Request
------------

    ESC "&" <cookie> ";4" 0x07 [frame_id] 0x00

[frame_id] = ID this identifies the frame of data which the terminal should transmit. The terminal replies by transmitting the data as lines of base64 encoded data preceded by a '#' hash character per line:

    '#' <base 64 data> '\n'

To indicate the end of data this is sent:

    '#;0\n'

Show file
---------

    ESC "&" <cookie> ";5;" [metadata size] 0x07 [metadata] [data]... [end] 0x00

[metadata] = JSON string representing an object with the keys: mimeType and filename.

[metadata size] = The length of the JSON metadata string.

[data] = "D:" [up to 3 kiobytes of base 64 data (=4*1024 chars in encoded form)] ":" [sha256 hash] CR

[end]= "E::" [sha256 hash] CR

The main body of data needs some explanation. It is basically lines of text. Each line is a 'chunk'. It is multiple 'data' chunks which are then terminated by a single 'end' chunk. Each data chunk holds up to 3KiB of file data which is then encoded as base64 giving max 4096 characters of data. The after the last chunk of data an 'end' chunk must be sent to indicate successful and complete transmission.

If the transmission needs to be gracefully aborted then an abort chunk can be sent:

[abort] = "A:: [sha256 hash] CR

The hash sent with chunk is the sha256 hash of the previous hash (binary) and the (binary) data being sent in the chunk. The first hash is simply the hash of the (binary) data.
