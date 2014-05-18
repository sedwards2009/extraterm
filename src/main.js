/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var _ = require('lodash-node');
var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var terminal = require('./terminal.js');

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
  var themeSelect;
  var blinkingCursorCheckbox;
  
  // Theme.
  themeSelect = doc.getElementById("theme_select");
  for (i=0; i<themeSelect.options.length; i++) {
    if (themeSelect.options[i].value === config.theme) {
      themeSelect.selectedIndex = i;
      break;
    }
  }
  
  // Blinking cursor.
  blinkingCursorCheckbox = doc.getElementById("blinking_cursor_checkbox");
  blinkingCursorCheckbox.checked = config.blinkingCursor;
};

/**
 * Get a config object which represents the state of the GUI.
 * 
 * @returns {Object} The new config.
 */
ConfigurePanel.prototype._guiToConfig = function() {
  var doc = this._element.ownerDocument;
  var themeSelect = doc.getElementById("theme_select");
  
  var blinkingCursorCheckbox = doc.getElementById("blinking_cursor_checkbox");
  var blinkingCursor = blinkingCursorCheckbox.checked;
  
  return { theme: themeSelect.value, blinkingCursor: blinkingCursor };
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
  var terminaltab = null;
  
  function startUp(windowGui) {
    var themesdir;
    
    gui = windowGui;
    doc = window.document;
    
    config = readConfiguration();
    
    config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;
            
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
      setupConfiguration(newConfig);
    });
    doc.getElementById("configure_button").addEventListener('click', function() {
      configurePanel.open(config);
    });
    
    terminaltab = new terminal.Terminal(window.document.getElementById("tab_container"));
    terminaltab.setBlinkingCursor(config.blinkingCursor);
    terminaltab.startUp();
  }
  
  function setupConfiguration(config) {
    installTheme(config.theme);
    if (terminaltab !== null) {
      terminaltab.setBlinkingCursor(config.blinkingCursor);
    }
  }
  
  /*
   * config object format: { theme: String, blinkingCursor: boolean}
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
