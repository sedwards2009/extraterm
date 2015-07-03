/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var spawn = require('child_process').spawn;
var timers = require('timers');

//var bridge = spawn('node', ['pty_bridge.js']);
var pythonExe = "python3";
// var pythonExe = 'C:\\Users\\sbe\\.babun\\cygwin\\bin\\python3.4m.exe'
var bridge = spawn(pythonExe, ['python/ptyserver2.py']);

bridge.stdout.on('data', function (data) {
  console.log("bridge: "+data);
});

bridge.stderr.on('data', function (data) {
  console.log('bridge stderr: ' + data);
});

bridge.on('close', function (code) {
  console.log('bridge process exited with code ' + code);
});

function sendData(text, callback) {
  var jsonString = JSON.stringify({stream: text});
  console.log("<<< json string is ",jsonString);
//  console.log("<<< json string length is ",jsonString.length);
//  var sizeHeaderBuffer = new Buffer(4);
//  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);
  
//  bridge.stdin.write(sizeHeaderBuffer);
  bridge.stdin.write(jsonString+"\n\n", callback);
}

var counter = 0;

timers.setInterval(function() {
  sendData('count '+counter+'\r');
  counter++;
}, 1000);
