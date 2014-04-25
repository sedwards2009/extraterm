/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
        
var pty = require('pty.js');

var term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
});

term.on('data', function(data) {
    process.stdout.write(data);
});
term.on('exit', function() {
    console.log("pty_bridge: term process exited.");
    process.exit(0);
});
process.stdin.on('data', function(data) {
    term.write(data);
});

//term.write('ls\r');
//term.resize(100, 40);
//term.write('ls /\r');
//console.log(term.process);
