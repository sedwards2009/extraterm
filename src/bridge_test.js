/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var spawn = require('child_process').spawn;

var bridge = spawn('node', ['pty_bridge.js']);
        
bridge.stdout.on('data', function (data) {
  console.log("bridge: "+data);
});

bridge.stderr.on('data', function (data) {
  console.log('bridge stderr: ' + data);
});

bridge.on('close', function (code) {
  console.log('bridge process exited with code ' + code);
});

bridge.stdin.write('ls\r', function() {
    bridge.stdin.write('exit\r');
});
