/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";

exports.startUp = (function() {
  "use strict";
    
  function startUp() {
    var termjs = require('term.js');
    var child_process = require('child_process');
    var cookie;
    var htmldata = null;
    
    cookie = "DEADBEEF";  // FIXME
    
    var term = new termjs.Terminal({
      cols: 80,
      rows: 30,
      scrollback: 10000,
      physicalScroll: true,
      applicationModeCookie: cookie
    });
    
    term.debug = true;
    
    term.on('title', function(title) {
      window.document.title = title;
    });

    term.open(window.document.body);
    
    window.addEventListener('resize', function() {
      var size = term.resizeToContainer();
      sendResize(size.cols, size.rows);
    });
    
    term.write('\x1b[31mWelcome to extraterm!\x1b[m\r\n');
    
    process.env[EXTRATERM_COOKIE_ENV] = cookie;

    // Start our PTY bridge process.
    var bridge = child_process.spawn('node', ['pty_bridge.js'], {
      env: process.env
    });
    bridge.stdout.on('data', function (data) {
      term.write("" + data);
    });

    bridge.stderr.on('data', function (data) {
      term.write(data);
    });

    bridge.on('close', function (code) {
      term.destroy();
      window.close();
    });
    
    function sendData(text, callback) {
      var jsonString = JSON.stringify({stream: text});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
      var sizeHeaderBuffer = new Buffer(4);
      sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

      bridge.stdin.write(sizeHeaderBuffer);
      bridge.stdin.write(jsonString, callback);
    }

    function sendResize(cols, rows, callback) {
      var jsonString = JSON.stringify({resize: [cols, rows]});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
      var sizeHeaderBuffer = new Buffer(4);
      sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

      bridge.stdin.write(sizeHeaderBuffer);
      bridge.stdin.write(jsonString, callback);  
    }

    term.on('data', function(data) {
      sendData(data);
    });
    
    term.on('application-mode-start', function(params) {
      console.log("application-mode started! ",params);
      htmldata = "";
    });

    term.on('application-mode-data', function(data) {
      console.log("html-mode data!", data);
      htmldata = htmldata + data;
    });
    term.on('application-mode-end', function() {
      var el = window.document.createElement("div");
      el.innerHTML = htmldata;
      term.appendElement(el);
      htmldata = null;
      console.log("html-mode end!");
    });
    
    var size = term.resizeToContainer();
    sendResize(size.cols, size.rows);

  }
    
  return startUp;
})();
