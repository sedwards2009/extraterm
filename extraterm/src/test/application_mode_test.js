/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
function write(msg) {
  process.stdout.write(msg);
}
write("Starting HTML mode\n");
write("\x1b&");
write(process.env["LC_EXTRATERM_COOKIE"]);
write("\x07");
write("this is HTML or something else!");
write("\x00");
write("Exited HTML mode\n");
