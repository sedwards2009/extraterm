/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
var SEMANTIC_TYPE = "data-extraterm-type";
var SEMANTIC_VALUE = "data-extraterm-value";
var SEMANTIC_START_OUTPUT = "data-extraterm-start-output";
var SEMANTIC_RETURN_CODE = "data-extraterm-return-code";

var APPLICATION_MODE_NONE = 0;
var APPLICATION_MODE_HTML = 1;
var APPLICATION_MODE_OUTPUT_BRACKET_START = 2;
var APPLICATION_MODE_OUTPUT_BRACKET_END = 3;
var TYPE_OUTPUT_START = "command-output-start";
var TYPE_OUTPUT = "command-output";

exports.startUp = (function() {
  "use strict";
    
  function startUp() {
    var termjs = require('term.js');
    var child_process = require('child_process');
    var cookie;
    var htmldata = null;
    var applicationmode = APPLICATION_MODE_NONE;
    var bracketstyle = null;
    var lastbashbracket = null;

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

    window.addEventListener('resize', function() {
      var size = term.resizeToContainer();
      sendResize(size.cols, size.rows);
    });

    process.env[EXTRATERM_COOKIE_ENV] = cookie;
    
    // Application mode handlers    
    term.on('application-mode-start', function(params) {
      console.log("application-mode started! ",params);
      if (params.length === 1) {
        // Normal HTML mode.
        applicationmode = APPLICATION_MODE_HTML;
        
      } else if(params.length >= 2) {
        switch ("" + params[1]) {
          case "2":
          applicationmode = APPLICATION_MODE_OUTPUT_BRACKET_START;
          bracketstyle = params[2];
          break;

        case "3":
          applicationmode = APPLICATION_MODE_OUTPUT_BRACKET_END;
          console.log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          break;

        default:
          console.log("Unrecognized application escape parameters.");
          break;
        }
      }
      htmldata = "";
    });

    term.on('application-mode-data', function(data) {
//      console.log("html-mode data!", data);
      if (applicationmode !== APPLICATION_MODE_NONE) {
        htmldata = htmldata + data;
      }
    });
    term.on('application-mode-end', function() {
      var el;
      var cleancommand;
      var trimmed;
      var startdivs;
      var outputdiv;
      var node;
      var nodelist;
      
      switch (applicationmode) {
        case APPLICATION_MODE_HTML:
          el = window.document.createElement("div");
          el.innerHTML = htmldata;
          term.appendElement(el);
          break;

        case APPLICATION_MODE_OUTPUT_BRACKET_START:
          if (lastbashbracket !== htmldata) {
            el = window.document.createElement("div");
            el.className = "extraterm_start_output";
            
            cleancommand = htmldata;
            if (bracketstyle === "bash") {
              // Bash includes the history number. Remove it.
              trimmed = htmldata.trimLeft();
              cleancommand = trimmed.slice(trimmed.indexOf(" ")).trimLeft();
            }
            el.setAttribute(SEMANTIC_TYPE, TYPE_OUTPUT_START);
            el.setAttribute(SEMANTIC_VALUE, cleancommand);
            term.appendElement(el);
            lastbashbracket = htmldata;
          }
          break;
          
        case APPLICATION_MODE_OUTPUT_BRACKET_END:
          console.log("startdivs:", startdivs);
          term.moveRowsToScrollback();
          startdivs = term.element.querySelectorAll("DIV[" + SEMANTIC_TYPE + "='" + TYPE_OUTPUT_START + "']");
          if (startdivs.length !== 0) {
            outputdiv = startdivs[startdivs.length-1];
            node = outputdiv.nextSibling;
            
            nodelist = [];
            while (node !== null) {
              nodelist.push(node);
              node = node.nextSibling;
            }
            nodelist.forEach(function(node) {
              outputdiv.appendChild(node);
            });
            outputdiv.setAttribute(SEMANTIC_TYPE, TYPE_OUTPUT);
            outputdiv.setAttribute(SEMANTIC_RETURN_CODE, htmldata);
            outputdiv.className = "extraterm_output";
          }
          
          break;
          
        default:
          break;
      }
      applicationmode = APPLICATION_MODE_NONE;
      
      console.log("html-mode end!",htmldata);
      htmldata = null;
    });
    
    function handleMineTypeClick(type, value) {
      if (type === "directory") {
        sendData("cd " + value + "\n"); // FIXME escaping
      }
    }
    
    // Window DOM event handlers
    window.document.body.addEventListener('click', function(event) {
      var type;
      var value;
      
//      console.log("body on click!",event);
      type = event.srcElement.getAttribute(SEMANTIC_TYPE);
      value = event.srcElement.getAttribute(SEMANTIC_VALUE);
      handleMineTypeClick(type, value);
      
    });
    
    term.open(window.document.getElementById("terminal_container"));
    term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');

    // Start our PTY bridge process and connect it to our terminal.
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
    
    var size = term.resizeToContainer();
    sendResize(size.cols, size.rows);
  }
    
  return startUp;
})();
