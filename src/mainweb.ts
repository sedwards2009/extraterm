/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import sourceMapSupport = require('source-map-support');
import im = require('immutable');
import _ = require('lodash');
import Messages = require('./windowmessages');
import webipc = require('./webipc');
import CbContextMenu = require('./gui/contextmenu');
import CbMenuItem = require('./gui/menuitem');
import CbDropDown = require('./gui/dropdown');
import CbCheckBoxMenuItem = require('./gui/checkboxmenuitem');
import MainWebUi = require('./mainwebui');
import EtTerminal = require('./terminal');
import AboutDialog = require('./aboutdialog');
import util = require('./gui/util');

import config = require('./config');
type Config = config.Config;
type SessionProfile = config.SessionProfile;

import Theme = require('./theme');

sourceMapSupport.install();

/**
 * This module is responsible has control of a window and is responsible for
 * starting up the main component and handling the window directly.
 */

let terminalIdCounter = 0;
let configuration: Config = null;

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

  webipc.registerDefaultHandler(Messages.MessageType.DEV_TOOLS_STATUS, handleDevToolsStatus);
  
  webipc.registerDefaultHandler(Messages.MessageType.CLIPBOARD_READ, handleClipboardRead);
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [webipc.requestConfig().then(handleConfigMessage),
                      webipc.requestThemes().then(handleThemesMessage)] );
  allPromise.then( (): Promise<FontFace[]> => {
    // Next phase is wait for the fonts to load.
    const fontPromises: Promise<FontFace>[] = [];
    window.document.fonts.forEach( (font: FontFace) => {
      if (font.status !== 'loaded' && font.status !== 'loading') {
        fontPromises.push(font.load());
      }
    });
    return Promise.all<FontFace>( fontPromises );
  }).then( () => {
    // Fonts are loaded, continue.
    CbContextMenu.init();
    CbMenuItem.init();
    CbDropDown.init();
    MainWebUi.init();
    CbCheckBoxMenuItem.init();

    mainWebUi = <MainWebUi>doc.createElement(MainWebUi.TAG_NAME);
    mainWebUi.innerHTML = `<div class="tab_bar_rest">
      <div class="space"></div>
      <cb-dropdown>
          <button class="topcoat-icon-button--large--quiet"><i class="fa fa-bars"></i></button>
          <cb-contextmenu id="main_menu">
              <cb-checkboxmenuitem icon="columns" id="split" name="split">Split</cb-checkboxmenuitem>
              <cb-menuitem icon="wrench" name="settings">Settings</cb-menuitem>
              <cb-checkboxmenuitem icon="cogs" id="developer_tools" name="developer_tools">Developer Tools</cb-checkboxmenuitem>
              <cb-menuitem icon="lightbulb-o" name="about">About</cb-menuitem>
          </cb-contextmenu>
      </cb-dropdown>
    </div>`;

    if (config !== null) {
      mainWebUi.config = configuration;
    }
    
    doc.body.appendChild(mainWebUi);
    
    // Make sure something sensible is focussed if the window gets the focus.
    window.addEventListener('focus', () => {
      mainWebUi.focus();
    });
    
    // Detect when the last tab has closed.
    mainWebUi.addEventListener(MainWebUi.EVENT_TAB_CLOSED, (ev: CustomEvent) => {
      if (mainWebUi.tabCount === 0) {
        webipc.windowCloseRequest();
      }
    });
    
    // Update the window title on request.
    mainWebUi.addEventListener(MainWebUi.EVENT_TITLE, (ev: CustomEvent) => {
      window.document.title = "Extraterm - " + ev.detail.title;
    });

    mainWebUi.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.keyCode === 83 && ev.ctrlKey && ev.shiftKey) {
        // Ctrl+Shift+S - Split/unsplit
        const splitMenu = <CbCheckBoxMenuItem> document.getElementById("split");
        const checked = ! splitMenu.checked;
        splitMenu.checked = checked;
        mainWebUi.split = checked;
      }
      ev.stopPropagation();
    });
        
    const mainMenu = doc.getElementById('main_menu');
    mainMenu.addEventListener('selected', (ev: CustomEvent) => {
      switch(ev.detail.name) {
        case 'split':
          const splitMenu = <CbCheckBoxMenuItem> document.getElementById("split");
          mainWebUi.split = util.toBoolean(splitMenu.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED));
          break;
          
        case 'settings':
          mainWebUi.openSettingsTab();
          break;
          
        case 'developer_tools':
          const developerToolMenu = <CbCheckBoxMenuItem> document.getElementById("developer_tools");
          webipc.devToolsRequest(util.toBoolean(developerToolMenu.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED)));
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
    
    doc.addEventListener('selectionchange', () => {
      mainWebUi.copyToClipboard();
    });
    doc.addEventListener('mousedown', (ev: MouseEvent) => {
      if (ev.which === 2) {
        webipc.clipboardReadRequest();
        
        // This is needed to stop the autoscroll blob from appearing on Windows.
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    mainWebUi.newTerminalTab(MainWebUi.POSITION_LEFT);
  });
}

function handleConfigMessage(msg: Messages.Message): void {
  const configMessage = <Messages.ConfigMessage> msg;
  configuration = configMessage.config;
  setupConfiguration(configMessage.config);
}

function handleThemesMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemesMessage> msg;
  themes = im.Map<string, Theme>();
  themesMessage.themes.forEach( (item: Theme) => {
    themes = themes.set(item.name, item);
  });
}

function handleDevToolsStatus(msg: Messages.Message): void {
  const devToolsStatusMessage = <Messages.DevToolsStatusMessage> msg;
  const developerToolMenu = <CbCheckBoxMenuItem> document.getElementById("developer_tools");
  developerToolMenu.setAttribute(CbCheckBoxMenuItem.ATTR_CHECKED, "" + devToolsStatusMessage.open);
}

function handleClipboardRead(msg: Messages.Message): void {
  const clipboardReadMessage = <Messages.ClipboardReadMessage> msg;
  mainWebUi.pasteText(clipboardReadMessage.text);
}

//-------------------------------------------------------------------------

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
