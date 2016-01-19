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

Show MIME data
--------------

    ESC "&" <cookie> ";5;" [mime type] 0x07 ";" [size] 0x07 [base 64 data] 0x00

[mime type] = 
[size] = size of the data in bytes (not base 64 encoded size!)
[base 64 data] = The stream of base64 encoded data.
