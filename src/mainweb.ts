/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import Config = require('config');
import Theme = require('./theme');
import im = require('immutable');
import _ = require('lodash');
// import terminal = require('./terminal');
// import configuredialog = require('./configuredialog');
// import commandframe = require('commandframe');
import Messages = require('./windowmessages');
import webipc = require('./webipc');
import MainWebUi = require('./mainwebui');


let terminalIdCounter = 0;
// let configureDialog: configuredialog = null;
let config: Config = null;
// let terminalList: TerminalTab[] = [];  // -> {id, terminal, terminaltab, tabheader};
// let focusedTerminalInfo: TerminalTab = null;
// let frameMapping: im.Map<string, commandframe> = im.Map<string, commandframe>();

let themes: im.Map<string, Theme>;
let mainWebUi: MainWebUi = null;

/**
 * 
 */
export function startUp(): void {
  webipc.start();
  
  const doc = window.document;
  
  // Default handling for config messages.
  webipc.registerDefaultHandler(Messages.MessageType.CONFIG, handleConfigMessage);
  
  // Default handling for theme messages.
  webipc.registerDefaultHandler(Messages.MessageType.THEMES, handleThemesMessage);
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [webipc.requestConfig().then(handleConfigMessage),
                      webipc.requestThemes().then(handleThemesMessage)] );
  allPromise.then( () => {
    MainWebUi.init();
    mainWebUi = <MainWebUi>doc.createElement(MainWebUi.TAG_NAME);
    doc.body.appendChild(mainWebUi);
  });
  
  // Configure dialog.
//   configureDialog = <configuredialog>doc.createElement(configuredialog.tagName);
//   doc.body.appendChild(configureDialog);
//   
//   configureDialog.addEventListener('ok', (newConfig: Config) => {
//     config = newConfig;
// //    writeConfiguration(newConfig); // FIXME
//     setupConfiguration(newConfig);
//   });
//   doc.getElementById("configure_button").addEventListener('click', function() {
//     configureDialog.open(config, themes);
//   });
// 
//   doc.getElementById("new_tab_button").addEventListener('click', function() {
//     focusTerminal(createTerminal());
//   });
//   
//   focusTerminal(createTerminal());
}

function handleConfigMessage(msg: Messages.Message): void {
  const configMessage = <Messages.ConfigMessage> msg;
  config = configMessage.config;
  setupConfiguration(configMessage.config);
}

function handleThemesMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemesMessage> msg;
  themes = im.Map<string, Theme>();
  themesMessage.themes.forEach( (item: Theme) => {
    themes = themes.set(item.name, item);
  });
}

//-------------------------------------------------------------------------

// configuredialog.init();

// class TerminalTab {
//   constructor(public id: number, public terminal: terminal.Terminal, public terminaltab: HTMLDivElement,
//     public tabheader: HTMLDivElement) {
//   }
// }

/**
 * 
 */
// function createTerminal(): number {
//   var doc = window.document;
// 
//   var thisId = terminalIdCounter;
//   terminalIdCounter++;
// 
//   // Create something to put the terminal in.
//   var terminaltab = doc.createElement("div");
//   terminaltab.className = "terminal_tab_inactive";
//   var container = doc.getElementById("tab_container");
//   container.appendChild(terminaltab);
// 
//   // Create the terminal itself.
//   var term = new terminal.Terminal(terminaltab);
//   term.setBlinkingCursor(config.blinkingCursor);
// //  term.events.on('ptyclose', handlePtyClose);
//   term.events.on('unknown-keydown', handleUnknownKeyDown);
//   term.events.on('title', handleTitle);
// //  term.events.on('frame-pop-out', handleFramePopOut);
//   
//   term.startUp();
// 
//   // Create the tab header.
//   var tabheader = doc.createElement("div");
//   tabheader.className = "tab_active";
//   tabheader.innerText = "New Tab";
//   tabheader.addEventListener('click', function() {
//     focusTerminal(thisId);
//   });
//   var tabbar = doc.getElementById("tabbar");
//   tabbar.insertBefore(tabheader, doc.getElementById("new_tab_button"));
// 
//   var info = new TerminalTab(thisId, term, terminaltab, tabheader);
//   terminalList.push(info);
//   return thisId;
// }

/**
 * 
 */
// function focusTerminal(id: number) {
//   terminalList.forEach(function(info) {
//     if (info.id === id) {
//       // Activate this one.
//       info.terminaltab.className = "terminal_tab_active";
//       info.tabheader.className = "tab_active";
//       info.terminal.focus();
//       focusedTerminalInfo = info;
//       setWindowTitle(info.terminal.getTitle());
//     } else {
//       // Deactive the rest.
//       info.terminaltab.className = "terminal_tab_inactive";
//       info.tabheader.className = "tab_inactive";
//     }
//   });
// }

/**
 * Set the window title.
 */
function setWindowTitle(title: string): void {
  window.document.title = "Extraterm - " + title;
}

/**
 * 
 */
// function handlePtyClose(term: terminal.Terminal): void {
//  destroyTerminal(_.find(terminalList, function(info) { return info.terminal === term; }).id);
// 
//  if (terminalList.length !== 0) {
//    focusTerminal(terminalList[0].id);
//  } else {
//    quit();
//  }
// }

/**
 * 
 */
// function shiftTab(direction: number): void {
//   if (terminalList.length === 0) {
//     return;
//   }
// 
//   var i = terminalList.indexOf(focusedTerminalInfo);
//   i = i + direction;
//   if (i < 0) {
//     i = terminalList.length - 1;
//   } else if (i >= terminalList.length) {
//     i = 0;
//   }
//   focusTerminal(terminalList[i].id);
// }

/**
 * 
 */
// function handleUnknownKeyDown(term: terminal.Terminal, ev: KeyboardEvent): void {
//   if (ev.keyCode === 37 && ev.shiftKey) {
//     // left-arrow
//     shiftTab(-1);
// 
//   } else if (ev.keyCode === 39 && ev.shiftKey) {
//     // right-arrow
//     shiftTab(1);
// 
//   } else if (ev.keyCode === 67 && ev.shiftKey) {
//     // Ctrl+Shift+C
// //    copyToClipboard();
// 
//   } else if (ev.keyCode === 86 && ev.shiftKey) {
//     // Ctrl+Shift+V
// //    pasteFromClipboard();
// 
//   } else if (ev.keyCode === 84 && ev.shiftKey) {
//     // Ctrl+Shift+T
//     focusTerminal(createTerminal());
// 
//   } else {
//     console.log("Unknown key:",ev);
//   }
// }

/**
 * Copy the selection to the clipboard.
 */
//function copyToClipboard(): void {
//  var selection = window.getSelection();
//  var range = selection.getRangeAt(0);
//  if (range.collapsed) {
//    return;
//  }
//  var text = range.toString();
//  var clipboard = gui.Clipboard.get();
//  clipboard.set(text.replace(/\u00a0/g,' '), 'text');
//}

/**
 * Paste text from the clipboard.
 */
//function pasteFromClipboard(): void {
//  var clipboard = gui.Clipboard.get();
//  var text = clipboard.get();
//  focusedTerminalInfo.terminal.send(text);
//  focusedTerminalInfo.terminal.scrollToBottom();
//}

/**
 * 
 */
// function handleTitle(term: terminal.Terminal, title: string): void {
//   var info = _.find(terminalList, function(info) { return info.terminal === term; });
//   var header = info.tabheader;
//   header.innerText = title;
//   header.setAttribute('title',title);
//   if (info === focusedTerminalInfo) {
//     setWindowTitle(title);
//   }
// }

//function handleFramePopOut(term: terminal.Terminal, frameElement: HTMLElement): void {
//  console.log("Got frame pop out message.");
//  var frame = <commandframe>frameElement;
//  frameMapping = frameMapping.set(frame.tag, frame);
//  gui.Window.open("frame.html?frametag="+ frame.tag, { position: "mouse", width: 512, height: 512 });
//}

/**
 * 
 */
//function destroyTerminal(id: number): void {
//  var i = _.findIndex(terminalList, (item) => item.id === id);
//  var info = terminalList[i];
//  info.terminal.destroy();
//  info.terminaltab.remove();
//  info.tabheader.remove();
//  terminalList.splice(i, 1);
//}

/**
 * 
 */
//function handleMessages(ev: MessageEvent): void {
//  var topMsg: windowmessages.Message = ev.data;
//console.log("main.ts: handleMessages");
//  switch(topMsg.type) {
//    case windowmessages.MessageType.REQUEST_FRAME:
//      
//      // First transmit the config.
//      var configMsg: windowmessages.MessageConfig = {
//        type: windowmessages.MessageType.CONFIG,
//        config: config
//      };
//      ev.source.postMessage(configMsg, ev.origin);
//  
//      var msg: windowmessages.MessageRequestFrame = ev.data;
//      if (frameMapping.has(msg.frameTag)) {
//        var frame = frameMapping.get(msg.frameTag);
//        frameMapping = frameMapping.remove(msg.frameTag);
//        
//        var reply: windowmessages.MessageFrameData = {
//          type: windowmessages.MessageType.FRAME_DATA,
//          frameTag: msg.frameTag,
//          frameHTML: frame.outerHTML
//        };
//        ev.source.postMessage(reply, ev.origin);
//        
//      } else {
//        console.log("Request for unknown frame tag: "+ msg.frameTag);
//      }
//      break;
//      
//    default:
//      console.log("Received an unrecognised message.");
//      break;
//  }
//}


/**
 * Quit the application.
 */
//function quit(): void {
//  window.close();
//}

/**
 * 
 */
function setupConfiguration(config: Config): void {
  installTheme(config.theme);
  // terminalList.forEach(function(info) {
  //   info.terminal.setBlinkingCursor(config.blinkingCursor);
  // });
}

/**
 * 
 */
function installTheme(themename: string): void {
  var doc = window.document;
  var themeLink = <HTMLLinkElement>doc.getElementById("theme_link");
  // themeLink.href = CoreWeb.getThemesDirectory() + "/" + themename + "/theme.css";
}
