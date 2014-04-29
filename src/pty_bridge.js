/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
        
var pty = require('pty.js');
var flexbuffer = require('./flexbuffer');
var inputbuffer = new flexbuffer.FlexBuffer();

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

/**
 * Processes packets.
 * 
 * The two packets types which are supported are chars and resize commands:
 * {stream: "...char data..."}
 * {resize: [cols, rows]}
 */
function processPacket(data) {
  if (data.resize !== undefined) {
    // Resize the terminal.
    term.resize(data.resize[0], data.resize[1]);
  } else {
    term.write(data.stream);
  }
}

function processStdin(chunk) {
  var payloadSize;
  var jsonPacket;
  var packetSize;
  
  inputbuffer.appendBuffer(chunk);
  
  while (inputbuffer.size() >= 4) {
    payloadSize = inputbuffer.buffer.readUInt32BE(0);
    packetSize = 4 + payloadSize;
    if (inputbuffer.size() >= packetSize) {
      jsonPacket = inputbuffer.buffer.toString('utf8', 4, packetSize);
      inputbuffer.delete(0, packetSize);
      processPacket(JSON.parse(jsonPacket));
    } else {
      break;
    }
  }
}

process.stdin.on('readable', function() {
  var chunk = process.stdin.read();
  while (null !== chunk) {
    processStdin(chunk);
    chunk = process.stdin.read();
  }
});
