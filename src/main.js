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

  var terminalIdCounter = 0;
  var themes;
  var configurePanel = null;
  var gui;
  var config;
  var doc;
  var terminalList = [];  // -> {id, terminal, terminaltab, tabheader};
  var focusedTerminalInfo = null;

  function createTerminal() {
    var term;
    var info;
    var doc = window.document;
    var container;
    var terminaltab;
    var tabbar;
    var tabheader;
    var thisId;
    
    thisId = terminalIdCounter;
    terminalIdCounter++;
    
    // Create something to put the terminal in.
    terminaltab = doc.createElement("div");
    terminaltab.className = "terminal_tab_inactive";
    container = doc.getElementById("tab_container");
    container.appendChild(terminaltab);
    
    // Create the terminal itself.
    term = new terminal.Terminal(terminaltab);
    term.setBlinkingCursor(config.blinkingCursor);
    term.on('ptyclose', handlePtyClose);
    term.on('shift-left', handleShiftTabLeft);
    term.on('shift-right', handleShiftTabRight);
    term.on('title', handleTitle);
    term.startUp();
    
    // Create the tab header.
    tabheader = doc.createElement("div");
    tabheader.className = "tab_active";
    tabheader.innerText = "New Tab";
    tabheader.addEventListener('click', function() {
      focusTerminal(thisId);
    });
    tabbar = doc.getElementById("tabbar");
    tabbar.insertBefore(tabheader, doc.getElementById("new_tab_button"));
    
    info = {id: thisId, terminal: term, terminaltab: terminaltab, tabheader: tabheader};
    terminalList[thisId] = info;
    return thisId;
  }
  
  function focusTerminal(id) {
    terminalList.forEach(function(info) {
      if (info.id === id) {
        // Activate this one.
        info.terminaltab.className = "terminal_tab_active";
        info.tabheader.className = "tab_active";
        info.terminal.focus();
        focusedTerminalInfo = info;
        setWindowTitle(info.terminal.getTitle());
      } else {
        // Deactive the rest.
        info.terminaltab.className = "terminal_tab_inactive";
        info.tabheader.className = "tab_inactive";
      }
    });
  }
  
  function setWindowTitle(title) {
    window.document.title = "Extraterm - " + title;
  }
  
  function handlePtyClose(term) {
    destroyTerminal(_.find(terminalList, function(info) { return info.terminal === term; }).id);
    
    if (terminalList.length !== 0) {
      focusTerminal(terminalList[0].id);
    } else {
      quit();
    }
  }
  
  function shiftTab(direction) {
    if (terminalList.length === 0) {
      return;
    }
    
    var i = terminalList.indexOf(focusedTerminalInfo);
    i = i + direction;
    if (i < 0) {
      i = terminalList.length - 1;
    } else if (i >= terminalList.length) {
      i = 0;
    }
    focusTerminal(terminalList[i].id);
  }
  
  function handleShiftTabLeft() {
    shiftTab(-1);
  }
  
  function handleShiftTabRight() {
    shiftTab(1);
  }
  
  function handleTitle(term, title) {
    var info = _.find(terminalList, function(info) { return info.terminal === term; });
    var header = info.tabheader;
    header.innerText = title;
    header.setAttribute('title',title);
    if (info === focusedTerminalInfo) {
      setWindowTitle(title);
    }
  }
  
  function destroyTerminal(id) {
    var i = terminalList.findIndex(function(item) { return item.id === id; });
    var info = terminalList[i];
    info.terminal.destroy();
    info.terminaltab.remove();
    info.tabheader.remove();
    terminalList.splice(i, 1);
  }
  
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

    doc.getElementById("new_tab_button").addEventListener('click', function() { focusTerminal(createTerminal()); });
    
    focusTerminal(createTerminal());
  }

  function quit() {
    window.close();
  }
  
  function setupConfiguration(config) {
    installTheme(config.theme);
    terminalList.forEach(function(info) {
      info.term.setBlinkingCursor(config.blinkingCursor);
    });
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
