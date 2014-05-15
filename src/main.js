/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
var _ = require('lodash-node');
var termjs = require('term.js');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var debug = false;
function log() {
  if (debug) {
    console.log.apply(this, arguments);
  }
}
/*************************************************************************/

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

/**
 * Create a new terminal.
 * 
 * See startUp().
 * 
 * @param {type} parentElement The DOM element under which the terminal will
 *     be placed.
 * @returns {Terminal}
 */
function Terminal(parentElement) {
  if (!(this instanceof Terminal)) {
    throw new Error("Call Terminal using the new keyword.");
  }
  this._parentElement = parentElement;
  _.bindAll(this);
  
  this._htmlData = null;
  this._applicationMode = APPLICATION_MODE_NONE;
  this._bracketStyle = null;
  this._lastBashBracket = null;
}

/**
 * Get the window which this terminal is on.
 * 
 * @returns {Window} The window object.
 */
Terminal.prototype._getWindow = function() {
  return this._parentElement.ownerDocument.defaultView;  
};

/**
 * Start the terminal up.
 * 
 * This method should be called once all event handlers have been set up.
 */
Terminal.prototype.startUp = function() {
  var size;
  var cookie;
  
  cookie = "DEADBEEF";  // FIXME
  process.env[EXTRATERM_COOKIE_ENV] = cookie;

  this._term = new termjs.Terminal({
    cols: 80,
    rows: 30,
    scrollback: 10000,
//      cursorBlink: false,
    physicalScroll: true,
    applicationModeCookie: cookie
  });
  this._term.debug = true;
  this._term.on('title', this._handleTitle);
  this._term.on('data', this._handleTermData);
  this._getWindow().addEventListener('resize', this._handleResize);

  // Application mode handlers    
  this._term.on('application-mode-start', this._handleApplicationModeStart);
  this._term.on('application-mode-data', this._handleApplicationModeData);
  this._term.on('application-mode-end', this._handleApplicationModeEnd);

  // Window DOM event handlers
  this._getWindow().document.body.addEventListener('click', this._handleWindowClick);

  this._term.open(this._parentElement);
  this._term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');

  // Start our PTY bridge process and connect it to our terminal.
  this._ptyBridge = child_process.spawn('node', ['pty_bridge.js'], {
    env: process.env
  });
  this._ptyBridge.stdout.on('data', this._handlePtyStdoutData);
  this._ptyBridge.stderr.on('data', this._handlePtyStderrData);
  this._ptyBridge.on('close', this._handlePtyClose);

  size = this._term.resizeToContainer();
  this._sendResize(size.cols, size.rows);
};

/**
 * Handler for window title change events from the pty.
 * 
 * @param {String} title The new window title for this terminal.
 */
Terminal.prototype._handleTitle = function(title) {
  this._getWindow().document.title = title;
};

/**
 * Handle a resize event from the window.
 */
Terminal.prototype._handleResize = function() {
  var size = this._term.resizeToContainer();
  this._sendResize(size.cols, size.rows);
};

/**
 * Handle when the embedded term.js enters start of application mode.
 * 
 * @param {array} params The list of parameter which were specified in the
 *     escape sequence.
 */
Terminal.prototype._handleApplicationModeStart = function(params) {
  log("application-mode started! ",params);
  if (params.length === 1) {
    // Normal HTML mode.
    this._applicationMode = APPLICATION_MODE_HTML;

  } else if(params.length >= 2) {
    switch ("" + params[1]) {
      case "2":
      this._applicationMode = APPLICATION_MODE_OUTPUT_BRACKET_START;
      this._bracketStyle = params[2];
      break;

    case "3":
      this._applicationMode = APPLICATION_MODE_OUTPUT_BRACKET_END;
      log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
      break;

    default:
      log("Unrecognized application escape parameters.");
      break;
    }
  }
  this._htmlData = "";
};

/**
 * Handle incoming data while in application mode.
 * 
 * @param {string} data The new data.
 */
Terminal.prototype._handleApplicationModeData = function(data) {
//      console.log("html-mode data!", data);
  if (this._applicationMode !== APPLICATION_MODE_NONE) {
    this._htmlData = this._htmlData + data;
  }
};

/**
 * Handle the exit from application mode.
 */
Terminal.prototype._handleApplicationModeEnd = function() {
  var el;
  var cleancommand;
  var trimmed;
  var startdivs;
  var outputdiv;
  var node;
  var nodelist;

  switch (this._applicationMode) {
    case APPLICATION_MODE_HTML:
      el = this._getWindow().document.createElement("div");
      el.innerHTML = this._htmlData;
      this._term.appendElement(el);
      break;

    case APPLICATION_MODE_OUTPUT_BRACKET_START:
      if (this._lastBashBracket !== this._htmlData) {
        el = this._getWindow().document.createElement("div");
        el.className = "extraterm_start_output";
        cleancommand = this._htmlData;
        if (this._bracketStyle === "bash") {
          // Bash includes the history number. Remove it.
          trimmed = this._htmlData.trimLeft();
          cleancommand = trimmed.slice(trimmed.indexOf(" ")).trimLeft();
        }
        el.setAttribute(SEMANTIC_TYPE, TYPE_OUTPUT_START);
        el.setAttribute(SEMANTIC_VALUE, cleancommand);
        this._term.appendElement(el);
        this._lastBashBracket = this._htmlData;
      }
      break;

    case APPLICATION_MODE_OUTPUT_BRACKET_END:
      log("startdivs:", startdivs);
      this._term.moveRowsToScrollback();
      startdivs = this._term.element.querySelectorAll("DIV[" + SEMANTIC_TYPE + "='" + TYPE_OUTPUT_START + "']");
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
        outputdiv.setAttribute(SEMANTIC_RETURN_CODE, this._htmlData);
        outputdiv.className = "extraterm_output";
      }

      break;

    default:
      break;
  }
  this._applicationMode = APPLICATION_MODE_NONE;

  log("html-mode end!",this._htmlData);
  this._htmlData = null;
};

/**
 * Handle a click inside the terminal.
 * 
 * @param {event} event
 */
Terminal.prototype._handleWindowClick = function(event) {
  var type;
  var value;

//      log("body on click!",event);
  type = event.srcElement.getAttribute(SEMANTIC_TYPE);
  value = event.srcElement.getAttribute(SEMANTIC_VALUE);
  this._handleMineTypeClick(type, value);
};

/**
 * Handle new stdout data from the pty.
 * 
 * @param {string} data New data.
 */
Terminal.prototype._handlePtyStdoutData = function (data) {
  log("incoming data:",""+data);
  this._term.write("" + data);
};

/**
 * Handle new stderr data from the pty.
 * 
 * @param {type} data New data.
 */
Terminal.prototype._handlePtyStderrData = function(data) {
  this._term.write(data);
};

/**
 * Handle a pty close event.
 * 
 * @param {string} data
 */
Terminal.prototype._handlePtyClose = function(data) {
  this._term.destroy();
  this._getWindow().close();
};
  
/**
 * Handle data coming from the user.
 * 
 * This just pushes the keys from the user through to the pty.
 * @param {string} data The data to process.
 */
Terminal.prototype._handleTermData = function(data) {
  this._sendDataToPty(data);
};

/**
 * Send data to the pseudoterminal.
 * 
 * @param {string} text
 * @param {function} callback (Optional) Callback to call once the data has
 *     been sent.
 */
Terminal.prototype._sendDataToPty = function(text, callback) {
  var jsonString = JSON.stringify({stream: text});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
  var sizeHeaderBuffer = new Buffer(4);
  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

  this._ptyBridge.stdin.write(sizeHeaderBuffer);
  this._ptyBridge.stdin.write(jsonString, callback);
};

/**
 * Send a resize message to the pty.
 * 
 * @param {number} cols The new number of columns in the terminal.
 * @param {number} rows The new number of rows in the terminal.
 * @param {function} callback (Optional) Callback to call once the data has
 *     been sent.
 */
Terminal.prototype._sendResize = function(cols, rows, callback) {
  var jsonString = JSON.stringify({resize: [cols, rows]});
//      console.log("<<< json string is ",jsonString);
//      console.log("<<< json string length is ",jsonString.length);
  var sizeHeaderBuffer = new Buffer(4);
  sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

  this._ptyBridge.stdin.write(sizeHeaderBuffer);
  this._ptyBridge.stdin.write(jsonString, callback);  
};

/**
 * Process a click on a item of the given mimetype and value.
 * 
 * @param {string} type
 * @param {string} value
 */
Terminal.prototype._handleMineTypeClick = function(type, value) {
  if (type === "directory") {
    this._sendDataToPty("cd " + value + "\n"); // FIXME escaping
  }
};

/*************************************************************************/

/**
 * Configuration Panel.
 * 
 * Emits event 'ok' with 1 parameter the config object when the OK button
 * is clicked. When the Cancel button is clicked, event 'cancel' is emitted.
 * 
 * @param {Object} options Object with format 'element', 'themes'
 * @returns {ConfigurePanel} The configuration panel.
 */
function ConfigurePanel(options) {
  var okButton;
  var cancelButton;
  var doc;
  var self = this;
  var themeSelect;
  
  if (!(this instanceof ConfigurePanel)) {
    throw new Error("Call ConfigurePanel using the new keyword.");
  }

  _.bindAll(this);
  
  this._element = options.element;
  doc = this._element.ownerDocument;
  
  this._themes = options.themes;

  okButton = doc.getElementById("ok_configure_button");
  okButton.addEventListener("click", this._handleOk);
  
  cancelButton = doc.getElementById("close_configure_button");
  cancelButton.addEventListener("click", this._handleCancel);
  
  themeSelect = doc.getElementById("theme_select");
  _.sortBy(_.keys(this._themes), function(a) {
    return this._themes[a].name;
  }, this).forEach(function(key) {
    var value = self._themes[key];
    var option = doc.createElement('option');
    option.value = key;
    option.text = value.name;
    themeSelect.add(option, null);
  });
  
}
util.inherits(ConfigurePanel, EventEmitter);

/**
 * Open the configure panel and show the configuration.
 * 
 * @param {Object} config The configuration to show.
 */
ConfigurePanel.prototype.open = function(config) {
  var doc = this._element.ownerDocument;
  var panel = doc.getElementById("configure_panel");
  
  this._configToGui(config);

  panel.classList.remove("configure_panel");
  panel.classList.add("configure_panel_open");
};

/**
 * Set the GUI to reflect a configuration.
 * 
 * @param {Object} config
 */
ConfigurePanel.prototype._configToGui = function(config) {
  var i;
  var doc = this._element.ownerDocument;
  var themeSelect = doc.getElementById("theme_select");
  
  for (i=0; i<themeSelect.options.length; i++) {
    if (themeSelect.options[i].value === config.theme) {
      themeSelect.selectedIndex = i;
      break;
    }
  }
};

/**
 * Get a config object which represents the state of the GUI.
 * 
 * @returns {Object} The new config.
 */
ConfigurePanel.prototype._guiToConfig = function() {
  var doc = this._element.ownerDocument;
  var themeSelect = doc.getElementById("theme_select");
  return { theme: themeSelect.value };
};

/**
 * Handler for OK button clicks.
 */
ConfigurePanel.prototype._handleOk = function() {
  this._close();
  this.emit('ok', this._guiToConfig());
};

/**
 * Handler for Cancel button clicks.
 */
ConfigurePanel.prototype._handleCancel = function() {
  this._close();
  this.emit('cancel');
};

/**
 * Close the dialog.
 */
ConfigurePanel.prototype._close = function() {
  var doc = this._element.ownerDocument;
  var panel = doc.getElementById("configure_panel");

  panel.classList.remove("configure_panel_open");
  panel.classList.add("configure_panel");
};

/*************************************************************************/
exports.startUp = (function() {
  "use strict";
  
  var CONFIG_FILENAME = "config";
  var THEMES_DIRECTORY = "themes";
  var THEME_CONFIG = "theme.json";

  var themes;
  var configurePanel = null;
  var gui;
  var config;
  var doc;
  
  function startUp(windowGui) {
    var themesdir;
    
    gui = windowGui;
    doc = window.document;
    
    config = readConfiguration();
    
    // Themes
    themesdir = path.join(__dirname, THEMES_DIRECTORY);
    themes = scanThemes(themesdir);
    if (themes[config.theme] === undefined) {
      config.theme = "default";
    }
    setupConfiguration(config);
    
    // Configure panel.
    configurePanel = new ConfigurePanel({element: window.document.getElementById("configure_panel"), themes: themes});
    configurePanel.on('ok', function(newConfig) {
      config = newConfig;
      writeConfiguration(newConfig);
      setupConfiguration(config);
    });
    doc.getElementById("configure_button").addEventListener('click', function() {
      configurePanel.open(config);
    });
    
    var terminaltab = new Terminal(window.document.getElementById("tab_container"));
    terminaltab.startUp();
  }
  
  function setupConfiguration(config) {
    installTheme(config.theme);
  }
  
  /*
   * config object format: { theme: "theme name" }
   */
  
  /**
   * Read the configuration.
   * 
   * @returns {Object} The configuration object.
   */
  function readConfiguration() {
    var filename = path.join(gui.App.dataPath, CONFIG_FILENAME);
    var configJson;
    var config = {};
    
    if (fs.existsSync(filename)) {
      configJson = fs.readFileSync(filename);
      config = JSON.parse(configJson);
    }
    return config;
  }
  
  /**
   * Write out the configuration to disk.
   * 
   * @param {Object} config The configuration to write.
   */
  function writeConfiguration(config) {
    var filename = path.join(gui.App.dataPath, CONFIG_FILENAME);
    fs.writeFileSync(filename, JSON.stringify(config));
  }
  
  /**
   * Scan for themes.
   * 
   * @param {String} themesdir The directory to scan for themes.
   * @returns {Array} Array of found theme config objects.
   */
  function scanThemes(themesdir) {
    var contents;
    var thememap = {};
    
    if (fs.existsSync(themesdir)) {
      contents = fs.readdirSync(themesdir);
      contents.forEach(function(item) {
        var infopath = path.join(themesdir, item, THEME_CONFIG);
        try {
          var infostr = fs.readFileSync(infopath, {encoding: "utf8"});
          var themeinfo = JSON.parse(infostr);
          
          if (validateThemeInfo(themeinfo)) {
            thememap[item] = themeinfo;
          }
          
        } catch(err) {
          console.log("Warning: Unable to read file ",infopath);
        }
      });
      return thememap;
    }
  }
  
  function validateThemeInfo(themeinfo) {
    return _.isString(themeinfo["name"]) && themeinfo["name"] !== "";
  }
  
  function installTheme(themename) {
    var themeLink = doc.getElementById("theme_link");
    themeLink.href = THEMES_DIRECTORY+ "/" + themename + "/theme.css";
  }
  
  return startUp;
})();
