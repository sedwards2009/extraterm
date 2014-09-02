/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<reference path='./chrome_lib.d.ts'/>
///<reference path="./typings/node/node.d.ts" />
///<reference path="./typings/node-webkit/node-webkit.d.ts" />
///<reference path="./bower_components/immutable-js/dist/Immutable.d.ts" />
///<amd-dependency path="nw.gui" />
import path = require('path');
import fs = require('fs');
import _ = require('lodash');
import terminal = require('./terminal');
import ConfigurePanel = require('./configure_panel');
import Theme = require('./theme');
import im = require('immutable');

var gui: typeof nw.gui = require('nw.gui');
  
var CONFIG_FILENAME = "config";
var THEMES_DIRECTORY = "themes";
var THEME_CONFIG = "theme.json";

var terminalIdCounter = 0;
var themes: im.Map<string, Theme>;
var configurePanel: ConfigurePanel = null;
var config: Config;
var terminalList: TerminalTab[] = [];  // -> {id, terminal, terminaltab, tabheader};
var focusedTerminalInfo: TerminalTab = null;

interface Config {
  blinkingCursor?: boolean;
  theme?: string;
}

class TerminalTab {
  constructor(public id: number, public terminal: terminal.Terminal, public terminaltab: HTMLDivElement,
    public tabheader: HTMLDivElement) {
  }
}

/**
 * 
 */
function createTerminal(): number {
  var doc = window.document;

  var thisId = terminalIdCounter;
  terminalIdCounter++;

  // Create something to put the terminal in.
  var terminaltab = doc.createElement("div");
  terminaltab.className = "terminal_tab_inactive";
  var container = doc.getElementById("tab_container");
  container.appendChild(terminaltab);

  // Create the terminal itself.
  var term = new terminal.Terminal(terminaltab);
  term.setBlinkingCursor(config.blinkingCursor);
  term.events.on('ptyclose', handlePtyClose);
  term.events.on('unknown-keydown', handleUnknownKeyDown);
  term.events.on('title', handleTitle);
  term.startUp();

  // Create the tab header.
  var tabheader = doc.createElement("div");
  tabheader.className = "tab_active";
  tabheader.innerText = "New Tab";
  tabheader.addEventListener('click', function() {
    focusTerminal(thisId);
  });
  var tabbar = doc.getElementById("tabbar");
  tabbar.insertBefore(tabheader, doc.getElementById("new_tab_button"));

  var info = new TerminalTab(thisId, term, terminaltab, tabheader);
  terminalList.push(info);
  return thisId;
}

/**
 * 
 */
function focusTerminal(id: number) {
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

/**
 * Set the window title.
 */
function setWindowTitle(title: string): void {
  window.document.title = "Extraterm - " + title;
}

/**
 * 
 */
function handlePtyClose(term: terminal.Terminal): void {
  destroyTerminal(_.find(terminalList, function(info) { return info.terminal === term; }).id);

  if (terminalList.length !== 0) {
    focusTerminal(terminalList[0].id);
  } else {
    quit();
  }
}

/**
 * 
 */
function shiftTab(direction: number): void {
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

/**
 * 
 */
function handleUnknownKeyDown(term: terminal.Terminal, ev: KeyboardEvent): void {
  if (ev.keyCode === 37 && ev.shiftKey) {
    // left-arrow
    shiftTab(-1);

  } else if (ev.keyCode === 39 && ev.shiftKey) {
    // right-arrow
    shiftTab(1);

  } else if (ev.keyCode === 67 && ev.shiftKey) {
    // Ctrl+Shift+C
    copyToClipboard();

  } else if (ev.keyCode === 86 && ev.shiftKey) {
    // Ctrl+Shift+V
    pasteFromClipboard();

  } else if (ev.keyCode === 84 && ev.shiftKey) {
    // Ctrl+Shift+T
    focusTerminal(createTerminal());

  } else {
    console.log("Unknown key:",ev);
  }
}

/**
 * Copy the selection to the clipboard.
 */
function copyToClipboard(): void {
  var selection = window.getSelection();
  var range = selection.getRangeAt(0);
  if (range.collapsed) {
    return;
  }
  var text = range.toString();
  var clipboard = gui.Clipboard.get();
  clipboard.set(text.replace(/\u00a0/g,' '), 'text');
}

/**
 * Paste text from the clipboard.
 */
function pasteFromClipboard(): void {
  var clipboard = gui.Clipboard.get();
  var text = clipboard.get();
  focusedTerminalInfo.terminal.send(text);
  focusedTerminalInfo.terminal.scrollToBottom();
}

/**
 * 
 */
function handleTitle(term: terminal.Terminal, title: string): void {
  var info = _.find(terminalList, function(info) { return info.terminal === term; });
  var header = info.tabheader;
  header.innerText = title;
  header.setAttribute('title',title);
  if (info === focusedTerminalInfo) {
    setWindowTitle(title);
  }
}

/**
 * 
 */
function destroyTerminal(id: number): void {
  var i = _.findIndex(terminalList, (item) => item.id === id);
  var info = terminalList[i];
  info.terminal.destroy();
  info.terminaltab.remove();
  info.tabheader.remove();
  terminalList.splice(i, 1);
}

/**
 * 
 */
function startUp(__dirname: string): void {
  var doc = window.document;

  config = readConfiguration();

  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;

  // Themes
  var themesdir = path.join(__dirname, THEMES_DIRECTORY);
  themes = scanThemes(themesdir);
  if (themes.get(config.theme) === undefined) {
    config.theme = "default";
  }
  setupConfiguration(config);

  // Configure panel.
  configurePanel = new ConfigurePanel(
          {element: window.document.getElementById("configure_panel"), themes: themes});
  configurePanel.events.on('ok', function(newConfig: Config) {
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

/**
 * Quit the application.
 */
function quit(): void {
  window.close();
}

/**
 * 
 */
function setupConfiguration(config: Config): void {
  installTheme(config.theme);
  terminalList.forEach(function(info) {
    info.terminal.setBlinkingCursor(config.blinkingCursor);
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
function readConfiguration(): Config {
  var filename = path.join(gui.App.dataPath, CONFIG_FILENAME);
  var config: Config = {};

  if (fs.existsSync(filename)) {
    var configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  }
  return config;
}

/**
 * Write out the configuration to disk.
 * 
 * @param {Object} config The configuration to write.
 */
function writeConfiguration(config: Config): void {
  var filename = path.join(gui.App.dataPath, CONFIG_FILENAME);
  fs.writeFileSync(filename, JSON.stringify(config));
}

/**
 * Scan for themes.
 * 
 * @param themesdir The directory to scan for themes.
 * @returns Map of found theme config objects.
 */
function scanThemes(themesdir: string): im.Map<string, Theme> {
  var thememap = im.Map<string, Theme>();
  if (fs.existsSync(themesdir)) {
    var contents = fs.readdirSync(themesdir);
    contents.forEach(function(item) {
      var infopath = path.join(themesdir, item, THEME_CONFIG);
      try {
        var infostr = fs.readFileSync(infopath, {encoding: "utf8"});
        var themeinfo = <Theme>JSON.parse(infostr);

        if (validateThemeInfo(themeinfo)) {
          thememap = thememap.set(item, themeinfo);
        }

      } catch(err) {
        console.log("Warning: Unable to read file ",infopath);
      }
    });
    return thememap;
  }
}

/**
 * 
 */
function validateThemeInfo(themeinfo: Theme): boolean {
  return _.isString(themeinfo.name) && themeinfo.name !== "";
}

/**
 * 
 */
function installTheme(themename: string): void {
  var doc = window.document;
  var themeLink = <HTMLLinkElement>doc.getElementById("theme_link");
  themeLink.href = THEMES_DIRECTORY+ "/" + themename + "/theme.css";
}
export = startUp;
