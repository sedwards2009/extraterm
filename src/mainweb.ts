/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import electron = require('electron');
const Menu = electron.remote.Menu;
const MenuItem = electron.remote.MenuItem;

import sourceMapSupport = require('source-map-support');
import _ = require('lodash');
import Logger = require('./logger');
import Messages = require('./windowmessages');
import webipc = require('./webipc');
import CbContextMenu = require('./gui/contextmenu');
import CbMenuItem = require('./gui/menuitem');
import CbDropDown = require('./gui/dropdown');
import CbCheckBoxMenuItem = require('./gui/checkboxmenuitem');
import CbCommandPalette = require('./gui/commandpalette');
import CommandPaletteTypes = require('./commandpalettetypes');
import CommandEntryType = require('./gui/commandentrytype');
import MainWebUi = require('./mainwebui');
import EtTerminal = require('./terminal');
import KeyBindingsElementBase = require('./keybindingselementbase');
import domutils = require('./domutils');
import util = require('./gui/util');

import EtEmbeddedViewer = require('./embeddedviewer');
import AboutTab = require('./abouttab');
import SettingsTab = require('./settings/settingstab2');
import EtTerminalViewer = require('./viewers/terminalviewer');
import EtTextViewer = require('./viewers/textviewer');
import ResizeCanary = require('./resizecanary');

import config = require('./config');
type Config = config.Config;
type SessionProfile = config.SessionProfile;

import ThemeTypes = require('./theme');
import ThemeConsumer = require('./themeconsumer');
type ThemeInfo = ThemeTypes.ThemeInfo;

import KeyBindingManager = require('./keybindingmanager');

sourceMapSupport.install();

const MENU_ITEM_SPLIT = 'split';
const MENU_ITEM_SETTINGS = 'settings';
const MENU_ITEM_KEY_BINDINGS = 'key_bindings';
const MENU_ITEM_DEVELOPER_TOOLS = 'developer_tools';
const MENU_ITEM_ABOUT = 'about';
const ID_COMMAND_PALETTE = "ID_COMMAND_PALETTE";

const _log = new Logger("mainweb");

/**
 * This module is responsible has control of a window and is responsible for
 * starting up the main component and handling the window directly.
 */

let terminalIdCounter = 0;
let configuration: Config = null;
let keyBindingContexts: KeyBindingManager.KeyBindingContexts = null;
let themes: ThemeInfo[];
let mainWebUi: MainWebUi = null;

/**
 * 
 */
export function startUp(): void {
  if (process.platform === "darwin") {
    setupOSXEmptyMenus();
  }

  // Theme control for the window level.
  const topThemeable: ThemeTypes.Themeable = {
    setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {      
      (<HTMLStyleElement> document.getElementById('THEME_STYLE')).textContent =
        cssMap.get(ThemeTypes.CssFile.GUI_CONTROLS) + "\n" + cssMap.get(ThemeTypes.CssFile.TOP_WINDOW);
    }
  };
  ThemeConsumer.registerThemeable(topThemeable);

  webipc.start();
  
  const doc = window.document;
  
  // Default handling for config messages.
  webipc.registerDefaultHandler(Messages.MessageType.CONFIG, handleConfigMessage);
  
  // Default handling for theme messages.
  webipc.registerDefaultHandler(Messages.MessageType.THEME_LIST, handleThemeListMessage);
  webipc.registerDefaultHandler(Messages.MessageType.THEME_CONTENTS, handleThemeContentsMessage);
  
  webipc.registerDefaultHandler(Messages.MessageType.DEV_TOOLS_STATUS, handleDevToolsStatus);
  
  webipc.registerDefaultHandler(Messages.MessageType.CLIPBOARD_READ, handleClipboardRead);
  
  const themePromise = webipc.requestConfig().then( (msg: Messages.ConfigMessage) => {
    return handleConfigMessage(msg);
  });
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [themePromise, webipc.requestThemeList().then(handleThemeListMessage)] );
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
    CbCommandPalette.init();
    ResizeCanary.init();

    window.addEventListener('resize', () => {
      if (mainWebUi !== null) {
        mainWebUi.resize();
      }
    });

    mainWebUi = <MainWebUi>doc.createElement(MainWebUi.TAG_NAME);
    mainWebUi.innerHTML = `<div class="tab_bar_rest">
      <div class="space"></div>
      <cb-dropdown>
          <button class="btn btn-quiet"><i class="fa fa-bars"></i></button>
          <cb-contextmenu id="main_menu">
              <cb-checkboxmenuitem icon="columns" id="${MENU_ITEM_SPLIT}" name="split">Split</cb-checkboxmenuitem>
              <cb-menuitem icon="wrench" name="${MENU_ITEM_SETTINGS}">Settings</cb-menuitem>
              <cb-menuitem icon="keyboard-o" name="${MENU_ITEM_KEY_BINDINGS}">Key Bindings</cb-menuitem>
              <cb-checkboxmenuitem icon="cogs" id="${MENU_ITEM_DEVELOPER_TOOLS}" name="developer_tools">Developer Tools</cb-checkboxmenuitem>
              <cb-menuitem icon="lightbulb-o" name="${MENU_ITEM_ABOUT}">About</cb-menuitem>
          </cb-contextmenu>
      </cb-dropdown>
    </div>`;

    mainWebUi.config = configuration;
    mainWebUi.themes = themes;
      
    doc.body.classList.remove("preparing");
    doc.body.innerHTML = "";  // Remove the old contents.
    
    doc.body.appendChild(mainWebUi);
    
    // A special element for tracking when terminal fonts are effectively changed in the DOM.
    const resizeCanary = <ResizeCanary> doc.createElement(ResizeCanary.TAG_NAME);
    doc.body.appendChild(resizeCanary);
    resizeCanary.addEventListener('resize', () => {
      mainWebUi.resize();
    });
    
    // Command palette
    const commandPalette = <CbCommandPalette> doc.createElement(CbCommandPalette.TAG_NAME);
    commandPalette.id = ID_COMMAND_PALETTE;
    doc.body.appendChild(commandPalette);
    commandPalette.addEventListener('selected', handleCommandPaletteSelected);
    
    // Make sure something sensible is focussed if the window gets the focus.
    window.addEventListener('focus', () => {
      mainWebUi.focus();
    });
    
    if (process.platform === "darwin") {
      setupOSXMenus(mainWebUi);
    }
    
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

    mainWebUi.addEventListener(MainWebUi.EVENT_SPLIT, () => {
      const splitMenu = <CbCheckBoxMenuItem> document.getElementById("split");
      splitMenu.checked = mainWebUi.split;
    });

    const mainMenu = doc.getElementById('main_menu');
    mainMenu.addEventListener('selected', (ev: CustomEvent) => {
      switch(ev.detail.name) {
        case MENU_ITEM_SPLIT:
          const splitMenu = <CbCheckBoxMenuItem> document.getElementById("split");
          mainWebUi.split = util.toBoolean(splitMenu.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED));
          break;
          
        case MENU_ITEM_SETTINGS:
          mainWebUi.openSettingsTab();
          break;
          
        case MENU_ITEM_KEY_BINDINGS:
          mainWebUi.openKeyBindingsTab();
          break;
          
        case MENU_ITEM_DEVELOPER_TOOLS:
          const developerToolMenu = <CbCheckBoxMenuItem> document.getElementById("developer_tools");
          webipc.devToolsRequest(util.toBoolean(developerToolMenu.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED)));
          break;

        case MENU_ITEM_ABOUT:
          mainWebUi.openAboutTab();
          break;
          
        default:
          
          break;
      }
    });
    
    mainWebUi.addEventListener(CommandPaletteTypes.EVENT_COMMAND_PALETTE_REQUEST, (ev: CustomEvent) => {
        handleCommandPaletteRequest(ev.detail);
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
    mainWebUi.focus();
    window.focus();
  });
}

function setupOSXEmptyMenus(): void {
  const template: GitHubElectron.MenuItemOptions[] = [{
    label: "Extraterm",
  }];
  
  const emptyTopMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(emptyTopMenu);  
}

function setupOSXMenus(mainWebUi: MainWebUi): void {
  const template: GitHubElectron.MenuItemOptions[] = [{
    label: "Extraterm",
    submenu: [
      {
        label: 'About Extraterm',
        click(item, focusedWindow) {
          mainWebUi.openAboutTab();
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'Preferences...',
        click(item, focusedWindow) {
          mainWebUi.openSettingsTab();
        },
      },
      {
        label: 'Key Bindings...',
        click(item, focusedWindow) {
          mainWebUi.openKeyBindingsTab();
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click(item, focusedWindow) {
          webipc.windowCloseRequest();
        },
        accelerator: 'Command+Q'
      }
    ]
  }];
  
  const topMenu = Menu.buildFromTemplate(template);
  
  Menu.setApplicationMenu(topMenu);
}

function handleConfigMessage(msg: Messages.Message): Promise<void> {
  const configMessage = <Messages.ConfigMessage> msg;
  const oldConfiguration = configuration;
  configuration = configMessage.config;
  return setupConfiguration(oldConfiguration, configMessage.config);
}

function handleThemeListMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemeListMessage> msg;
  themes = themesMessage.themeInfo
}

function handleThemeContentsMessage(msg: Messages.Message): void {
  const themeContentsMessage = <Messages.ThemeContentsMessage> msg;
  
  if (themeContentsMessage.success) {
    const cssFileMap = new Map<ThemeTypes.CssFile, string>();
    ThemeTypes.cssFileEnumItems.forEach( (cssFile) => {
      cssFileMap.set(cssFile, themeContentsMessage.themeContents.cssFiles[ThemeTypes.cssFileNameBase(cssFile)]);
    });

    // Distribute the CSS files to the classes which want them.
    ThemeConsumer.updateCss(cssFileMap);
  } else {
    
    // Something went wrong.
    _log.warn(themeContentsMessage.errorMessage);
    
    if (themeContentsMessage.themeIdList.every( id => id === ThemeTypes.DEFAULT_THEME)) {
      // Error occurred while trying to generate the default themes.
      window.alert("Something has gone wrong. The default theme couldn't be generated. Sorry.");
    } else {
      _log.warn("Attempting to use the default theme.");
      window.alert("Something has gone wrong while generating the theme. The default theme will be tried.");
      requestThemeContents(ThemeTypes.DEFAULT_THEME, ThemeTypes.DEFAULT_THEME, ThemeTypes.DEFAULT_THEME);
    }
  }
}

function handleDevToolsStatus(msg: Messages.Message): void {
  const devToolsStatusMessage = <Messages.DevToolsStatusMessage> msg;
  const developerToolMenu = <CbCheckBoxMenuItem> document.getElementById("developer_tools");
  if (developerToolMenu === null) {
    return;
  }
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
function setupConfiguration(oldConfig: Config, newConfig: Config): Promise<void> {
  if (mainWebUi !== null) {
    mainWebUi.config = newConfig;
  }
  
  keyBindingContexts = KeyBindingManager.loadKeyBindingsFromObject(newConfig.systemConfig.keyBindingsContexts);
  KeyBindingsElementBase.setKeyBindingContexts(keyBindingContexts);
  
  if (oldConfig === null || oldConfig.terminalFontSize !== newConfig.terminalFontSize ||
      oldConfig.terminalFont !== newConfig.terminalFont) {
        
    const matchingFonts = newConfig.systemConfig.availableFonts.filter(
      (font) => font.postscriptName === newConfig.terminalFont);
    setCssVars(newConfig.terminalFont, matchingFonts[0].path, newConfig.terminalFontSize);
  }

  if (oldConfig === null || oldConfig.themeTerminal !== newConfig.themeTerminal ||
      oldConfig.themeSyntax !== newConfig.themeSyntax ||
      oldConfig.themeGUI !== newConfig.themeGUI) {

    oldConfig = newConfig;
    return requestThemeContents(oldConfig.themeTerminal, oldConfig.themeSyntax, oldConfig.themeGUI);
  }
  
  oldConfig = newConfig;
  
  // no-op promise.
  return new Promise<void>( (resolve, cancel) => { resolve(); } );
}

function requestThemeContents(themeTerminal: string, themeSyntax: string, themeGUI: string): Promise<void> {
  const themeIdList = [];
  if (themeTerminal !== ThemeTypes.DEFAULT_THEME) {
    themeIdList.push(themeTerminal);
  }
  if (themeSyntax !== ThemeTypes.DEFAULT_THEME) {
    themeIdList.push(themeSyntax);
  }
  if (themeGUI !== ThemeTypes.DEFAULT_THEME) {
    themeIdList.push(themeGUI);
  }
  themeIdList.push(ThemeTypes.DEFAULT_THEME);
  return webipc.requestThemeContents(themeIdList).then(handleThemeContentsMessage);
}

function setCssVars(fontName: string, fontPath: string, terminalFontSize: number): void {
  const fontCssName = fontName.replace(/\W/g, "_");
  (<HTMLStyleElement> document.getElementById('CSS_VARS')).textContent =
    `
    @font-face {
      font-family: "${fontCssName}";
      src: url("${fontPath}");
    }

    :root {
      --terminal-font-size: ${terminalFontSize}px;
      --terminal-font: "${fontCssName}";
    }
    `;
}

//-----------------------------------------------------------------------
//
//   #####                                               ######                                          
//  #     #  ####  #    # #    #   ##   #    # #####     #     #   ##   #      ###### ##### ##### ###### 
//  #       #    # ##  ## ##  ##  #  #  ##   # #    #    #     #  #  #  #      #        #     #   #      
//  #       #    # # ## # # ## # #    # # #  # #    #    ######  #    # #      #####    #     #   #####  
//  #       #    # #    # #    # ###### #  # # #    #    #       ###### #      #        #     #   #      
//  #     # #    # #    # #    # #    # #   ## #    #    #       #    # #      #        #     #   #      
//   #####   ####  #    # #    # #    # #    # #####     #       #    # ###### ######   #     #   ###### 
//                                                                                                      
//-----------------------------------------------------------------------
let commandPaletteRequest: CommandPaletteTypes.CommandPaletteRequest = null;

function handleCommandPaletteRequest(request: CommandPaletteTypes.CommandPaletteRequest): void {
  
  domutils.doLater( () => {
    commandPaletteRequest = request;
    
    const paletteEntries = request.commandEntries.map( (entry, index): CommandEntryType.CommandEntry => {
      return {
        id: "" + index,
        iconLeft: entry.iconLeft,
        iconRight: entry.iconRight,
        label: entry.label,
        shortcut: entry.shortcut
      };
    });
    
    const commandPalette = <CbCommandPalette> document.getElementById(ID_COMMAND_PALETTE);
    commandPalette.entries = paletteEntries;
    commandPalette.open(10,10);
  });
}

function handleCommandPaletteSelected(ev: CustomEvent): void {
  const commandPalette = <CbCommandPalette> document.getElementById(ID_COMMAND_PALETTE);
  commandPalette.close();
  if (commandPaletteRequest.srcElement !== null) {
    commandPaletteRequest.srcElement.focus();
  }
  
  const entryId = ev.detail.entryId;
  if (entryId !== null) {
    const commandIndex = Number.parseInt(entryId);
    const commandEntry = commandPaletteRequest.commandEntries[commandIndex];
    domutils.doLater( () => {
      commandEntry.target.executeCommand(commandEntry.id);
      commandPaletteRequest = null;
    });
  }
}
