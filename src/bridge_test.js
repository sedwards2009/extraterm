/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var spawn = require('child_process').spawn;
var timers = require('timers');

//var bridge = spawn('node', ['pty_bridge.js']);
var pythonExe = process.platform === 'win32' ? 'C:\\Users\\sbe\\.babun\\cygwin\\bin\\python3.4m.exe' : 'python3';
var bridge = spawn(pythonExe, ['python/ptyserver2.py']);

bridge.stdout.on('data', function (data) {
  console.log("main <<< server : "+data);
});

bridge.stderr.on('data', function (data) {
  console.log('main <<< server stderr : ' + data);
});

bridge.on('close', function (code) {
  console.log('bridge process exited with code ' + code);
});

function sendData(text, callback) {
  var jsonString = JSON.stringify({stream: text});
  console.log("main >>> server : " + jsonString);
//  console.log("<<< json string length is ",jsonString.length);
//  var sizeHeaderBuffer = new Buffer(4);
//  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);
  
//  bridge.stdin.write(sizeHeaderBuffer);
  bridge.stdin.write(jsonString+"\n", callback);
}

function sendMessage(msg) {
  var jsonString = JSON.stringify(msg);
  console.log("main >>> server : ",jsonString);
  bridge.stdin.write(jsonString+"\n");
}

var counter = 0;
var todo = [
  {type: "create", rows: 24, columns: 80, argv: ["/usr/bin/seq","3"]}
];

timers.setInterval(function() {
  if (counter < todo.length) {
    sendMessage(todo[counter]);
  }
  counter++;
}, 1000);
