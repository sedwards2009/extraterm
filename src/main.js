/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
exports.startUp = (function() {
  "use strict";
    
  function startUp() {
    var termjs = require('term.js');
    var child_process = require('child_process');

    var term = new termjs.Terminal({
      cols: 80,
      rows: 30,
      screenKeys: true
    });

    term.on('title', function(title) {
      window.document.title = title;
    });

    term.open(window.document.body);

    term.write('\x1b[31mWelcome to term.js!\x1b[m\r\n');

//    socket.on('data', function(data) {
//      term.write(data);
//    });

    var bridge = child_process.spawn('node', ['pty_bridge.js']);
    bridge.stdout.on('data', function (data) {
//      console.log("Incoming: "+data);
      term.write("" + data);
    });

    bridge.stderr.on('data', function (data) {
      term.write(data);
    });

    bridge.on('close', function (code) {
      term.destroy();
    });

    term.on('data', function(data) {
      bridge.stdin.write(data);
    });

  }
    
  return startUp;
})();
