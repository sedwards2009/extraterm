/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import sourceMapSupport = require('source-map-support');
import Config = require('config');
import Theme = require('./theme');
import im = require('immutable');
import _ = require('lodash');
// import configuredialog = require('./configuredialog');
// import commandframe = require('commandframe');
import Messages = require('./windowmessages');
import webipc = require('./webipc');
import CbContextMenu = require('./gui/contextmenu');
import CbMenuItem = require('./gui/menuitem');
import CbDropDown = require('./gui/dropdown');
import MainWebUi = require('./mainwebui');
import AboutDialog = require('./aboutdialog');

sourceMapSupport.install();

/**
 * This module is responsible has control of a window and is responsible for
 * starting up the main component and handling the window directly.
 */

let terminalIdCounter = 0;
// let configureDialog: configuredialog = null;
let config: Config = null;
// let terminalList: TerminalTab[] = [];  // -> {id, terminal, terminaltab, tabheader};
// let focusedTerminalInfo: TerminalTab = null;
// let frameMapping: im.Map<string, commandframe> = im.Map<string, commandframe>();

let themes: im.Map<string, Theme>;
let mainWebUi: MainWebUi = null;
let aboutDialog: AboutDialog = null;

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
    CbContextMenu.init();
    CbMenuItem.init();
    CbDropDown.init();
    MainWebUi.init();
    mainWebUi = <MainWebUi>doc.createElement(MainWebUi.TAG_NAME);
    mainWebUi.innerHTML = `<div class="tab_bar_rest">
      <button class="topcoat-icon-button--quiet">
        <i class="fa fa-plus"></i>
      </button>
      <div class="space"></div>
      <cb-dropdown>
          <button class="topcoat-icon-button--large--quiet"><i class="fa fa-bars"></i></button>
          <cb-contextmenu id="main_menu">
              <cb-menuitem icon="wrench" name="settings">Settings</cb-menuitem>
              <cb-menuitem icon="lightbulb-o" name="about">About</cb-menuitem>
          </cb-contextmenu>
      </cb-dropdown>
    </div>`;
    if (config !== null) {
      mainWebUi.config = config;
    }
    doc.body.appendChild(mainWebUi);
    
    // Detect when the last tab has closed.
    mainWebUi.addEventListener(MainWebUi.EVENT_TAB_CLOSED, (ev: CustomEvent) => {
      window.setTimeout( () => {
        if (mainWebUi.tabCount === 0) {
          window.close();
        }
      }, 0);
    });
    
    mainWebUi.addEventListener(MainWebUi.EVENT_TITLE, (ev: CustomEvent) => {
      window.document.title = "Extraterm - " + ev.detail.title;
    });
    
    const mainMenu = doc.getElementById('main_menu');
    mainMenu.addEventListener('selected', (ev: CustomEvent) => {
      switch(ev.detail.name) {
        case 'settings':
          
          break;
          
        case 'about':
          if (aboutDialog == null) {
            AboutDialog.init();
            aboutDialog = <AboutDialog>doc.createElement(AboutDialog.TAG_NAME);
            doc.body.appendChild(aboutDialog);
          }
          aboutDialog.open();
          break;
          
        default:
          
          break;
      }
    });
    
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
  console.log("mainweb.handleConfigMessage");
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
  if (mainWebUi !== null) {
    mainWebUi.config = config;
  }
}

/**
 * 
 */
function installTheme(themename: string): void {
  var doc = window.document;
  var themeLink = <HTMLLinkElement>doc.getElementById("theme_link");
  // themeLink.href = CoreWeb.getThemesDirectory() + "/" + themename + "/theme.css";
}
