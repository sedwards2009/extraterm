/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var _ = require('lodash-node');
var fs = require('fs');
var path = require('path');

var terminal = require('./terminal.js');
var configure_panel = require('./configure_panel.js');

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
    configurePanel = new configure_panel.ConfigurePanel(
            {element: window.document.getElementById("configure_panel"), themes: themes});
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
