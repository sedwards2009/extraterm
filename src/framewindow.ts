/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<amd-dependency path="nw.gui" />

import qs = require('qs');
import windowmessages = require('windowmessages');

import commandframe = require('commandframe');

var gui: typeof nw.gui = require('nw.gui');

var THEMES_DIRECTORY = "themes";

commandframe.init();

/**
 * Set the window title.
 */
function setWindowTitle(title: string): void {
  window.document.title = "Extraterm - " + title;
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
 * 
 */
function handleMessages(ev: MessageEvent): void {
  var topMsg: windowmessages.Message = ev.data;
  switch(topMsg.type) {
    case windowmessages.MessageType.FRAME_DATA:
      var frameDataMsg = <windowmessages.MessageFrameData> topMsg;
      var div = window.document.createElement('div');
      div.classList.add('terminal');
      div.classList.add('frameterminal');
      div.innerHTML = frameDataMsg.frameHTML;
      window.document.body.appendChild(div);
      break;
      
    case windowmessages.MessageType.CONFIG:
      var configMsg = <windowmessages.MessageConfig> topMsg;
      installTheme(configMsg.config.theme);
      break;
      
    default:
      console.log("Received an unrecognised message.");
      break;
  }
}

/**
 * 
 */
function startUp(__dirname: string): void {
  var doc = window.document;

  window.addEventListener('message', handleMessages, false);

  var parameters = qs.parse(window.location.search.slice(1));
console.log("parameters: " + JSON.stringify(parameters));  
  var frameRequest: windowmessages.MessageRequestFrame = {
    type: windowmessages.MessageType.REQUEST_FRAME,
    frameTag: parameters["frametag"]
  };
  window.opener.postMessage(frameRequest, "*");
  
//  config = readConfiguration();
//
//  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;
//
//  // Themes
//  var themesdir = path.join(__dirname, THEMES_DIRECTORY);
//  themes = scanThemes(themesdir);
//  if (themes.get(config.theme) === undefined) {
//    config.theme = "default";
//  }
//  setupConfiguration(config);
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
