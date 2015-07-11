/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import sourceMapSupport = require('source-map-support');
import im = require('immutable');
import _ = require('lodash');
// import configuredialog = require('./configuredialog');
// import commandframe = require('commandframe');
import Messages = require('./windowmessages');
import webipc = require('./webipc');
import CbContextMenu = require('./gui/contextmenu');
import CbMenuItem = require('./gui/menuitem');
import CbDropDown = require('./gui/dropdown');
import CbCheckBoxMenuItem = require('./gui/checkboxmenuitem');
import MainWebUi = require('./mainwebui');
import AboutDialog = require('./aboutdialog');
import util = require('./gui/util');

import configInterfaces = require('config');
type Config = configInterfaces.Config;
type SessionProfile = configInterfaces.SessionProfile;

import Theme = require('./theme');
import DEFAULT_SESSION_PROFILES = require('./defaultsessionprofiles');

sourceMapSupport.install();

/**
 * This module is responsible has control of a window and is responsible for
 * starting up the main component and handling the window directly.
 */

let terminalIdCounter = 0;
// let configureDialog: configuredialog = null;
let config: Config = null;
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

  webipc.registerDefaultHandler(Messages.MessageType.DEV_TOOLS_STATUS, handleDevToolsStatus);
  
  webipc.registerDefaultHandler(Messages.MessageType.CLIPBOARD_READ, handleClipboardRead);
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [webipc.requestConfig().then(handleConfigMessage),
                      webipc.requestThemes().then(handleThemesMessage)] );
  allPromise.then( () => {
    CbContextMenu.init();
    CbMenuItem.init();
    CbDropDown.init();
    MainWebUi.init();
    CbCheckBoxMenuItem.init();

    mainWebUi = <MainWebUi>doc.createElement(MainWebUi.TAG_NAME);
    mainWebUi.innerHTML = `<div class="tab_bar_rest">
      <button class="topcoat-icon-button--quiet" id="new_tab_button">
        <i class="fa fa-plus"></i>
      </button>
      <div class="space"></div>
      <cb-dropdown>
          <button class="topcoat-icon-button--large--quiet"><i class="fa fa-bars"></i></button>
          <cb-contextmenu id="main_menu">
              <cb-menuitem icon="wrench" name="settings">Settings</cb-menuitem>
              <cb-checkboxmenuitem icon="cogs" id="developer_tools" name="developer_tools">Developer Tools</cb-checkboxmenuitem>
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
    
    // Update the window title on request.
    mainWebUi.addEventListener(MainWebUi.EVENT_TITLE, (ev: CustomEvent) => {
      window.document.title = "Extraterm - " + ev.detail.title;
    });
    
    const mainMenu = doc.getElementById('main_menu');
    mainMenu.addEventListener('selected', (ev: CustomEvent) => {
      switch(ev.detail.name) {
        case 'settings':
          
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
    
    const newTabButton = <HTMLButtonElement> document.getElementById('new_tab_button');
    newTabButton.addEventListener('click', () => {
      mainWebUi.focusTerminalTab(mainWebUi.newTerminalTab(defaultSessionProfile()));
    });
    
    doc.addEventListener('selectionchange', () => {
      mainWebUi.copyToClipboard();
    });
    doc.addEventListener('mousedown', (ev: MouseEvent) => {
      if (ev.which === 2) {
        webipc.clipboardReadRequest();
      }
    });
    
    mainWebUi.newTerminalTab(defaultSessionProfile());
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
}

function defaultSessionProfile(): SessionProfile {
  const merged = mergeSessionProfiles(DEFAULT_SESSION_PROFILES, config.sessionProfiles);
  const candidates = merged.filter( (sp) => {
    if (sp.platform === null || sp.platform === undefined) {
      return true;
    }
    return Array.isArray(sp.platform) ? sp.platform.indexOf(process.platform) !== -1 : sp.platform === process.platform;
  });
    
  return candidates.length !== 0 ? candidates[0] : null;
}

function mergeSessionProfiles(primaryList: SessionProfile[], secondaryList: SessionProfile[]): SessionProfile[] {
  const resultList = <SessionProfile[]> _.cloneDeep(primaryList);
  if (secondaryList === null || secondaryList === undefined) {
    return resultList;
  }
  
  const nameMap = new Map<string, SessionProfile>();
  // FIXME there is probably a simpler way of doing this once ES6 support improves.
  secondaryList.forEach( (sp) => {
    nameMap.set(sp.name, sp);
  });
  
  resultList.forEach( (sp) => {
    if (nameMap.has(sp.name)) {
      // If the secondary list has a replacement or override for a a session profile, then process it now.
      const secondary = nameMap.get(sp.name);
      
      sp.command = override(sp.command, secondary.command);
      sp.platform = override(sp.platform, secondary.platform);
      
      if (secondary.extraEnv !== null && secondary.extraEnv !== undefined) {
        if (sp.extraEnv !== null || sp.extraEnv === undefined) {
          sp.extraEnv = {};
        }
        
        let prop: string;
        for (prop in secondary.extraEnv) {
          sp.extraEnv[prop] = secondary.extraEnv[prop];          
        }
      }
    }
    nameMap.delete(sp.name);
  });

  // Append any sessions in the secondary list which didn't appear in the primary.
  nameMap.forEach( (sp) => {
    resultList.splice(0,0, sp);
  });

  return resultList;
}

/**
 * Returns the new value if is is available otherwise de default value.
 *
 * @param defaultValue
 * @param newValue
 * @return Either the default value or the new value.
 */
function override(defaultValue: any, newValue: any): any {
  return newValue !== null && newValue !== undefined ? newValue : defaultValue;
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

//function handleFramePopOut(term: terminal.Terminal, frameElement: HTMLElement): void {
//  console.log("Got frame pop out message.");
//  var frame = <commandframe>frameElement;
//  frameMapping = frameMapping.set(frame.tag, frame);
//  gui.Window.open("frame.html?frametag="+ frame.tag, { position: "mouse", width: 512, height: 512 });
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
