/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable, Event} from 'extraterm-extension-api';
import * as Electron from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import * as SourceMapSupport from 'source-map-support';

const ElectronMenu = Electron.remote.Menu;
const ElectronMenuItem = Electron.remote.MenuItem;

import {AboutTab} from './AboutTab';
import './gui/All'; // Need to load all of the GUI web components into the browser engine
import {CheckboxMenuItem} from './gui/CheckboxMenuItem';
import {CommandMenuItem, commandPaletteFilterEntries, commandPaletteFormatEntries} from './CommandPaletteFunctions';
import {CommandEntry, Commandable, EVENT_COMMAND_PALETTE_REQUEST, isCommandable, CommandExecutor}
    from './CommandPaletteRequestTypes';
import {Config, ConfigDistributor, SessionConfig, injectConfigDistributor} from '../Config';
import {ContextMenu} from './gui/ContextMenu';
import {doLater} from '../utils/DoLater';
import * as DomUtils from './DomUtils';
import {DropDown} from './gui/DropDown';
import {EmbeddedViewer} from './viewers/EmbeddedViewer';
import {ExtensionManagerImpl} from './extension/ExtensionManager';
import {ExtensionManager} from './extension/InternalTypes';
import {EVENT_DRAG_STARTED, EVENT_DRAG_ENDED} from './GeneralEvents';
import * as keybindingmanager from './keybindings/KeyBindingManager';
import {Logger, getLogger} from '../logging/Logger';
import {MainWebUi} from './MainWebUi';
import {MenuItem} from './gui/MenuItem';
import {PopDownListPicker} from './gui/PopDownListPicker';
import {ResizeCanary} from './ResizeCanary';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';
import {SettingsTab} from './settings/SettingsTab';
import * as SupportsDialogStack from './SupportsDialogStack';
import {TabWidget} from './gui/TabWidget';
import {EtTerminal} from './Terminal';
import {TerminalViewer} from './viewers/TerminalViewer';
import {TextViewer} from'./viewers/TextViewer';
import * as ThemeTypes from '../theme/Theme';
import * as ThemeConsumer from '../theme/ThemeConsumer';
import * as Util from './gui/Util';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';
import { EventEmitter } from '../utils/EventEmitter';

type ThemeInfo = ThemeTypes.ThemeInfo;

type KeyBindingManager = keybindingmanager.KeyBindingsManager;
type KeyBindingsContexts = keybindingmanager.KeyBindingsContexts;

SourceMapSupport.install();

const PLUGINS_DIRECTORY = "plugins";

const PALETTE_GROUP = "mainweb";
const MENU_ITEM_SETTINGS = 'settings';
const MENU_ITEM_DEVELOPER_TOOLS = 'developer_tools';
const MENU_ITEM_ABOUT = 'about';
const MENU_ITEM_RELOAD_CSS = 'reload_css';
const ID_COMMAND_PALETTE = "ID_COMMAND_PALETTE";
const ID_MAIN_MENU = "ID_MAIN_MENU";
const ID_MENU_BUTTON = "ID_MENU_BUTTON";
const CLASS_MAIN_DRAGGING = "CLASS_MAIN_DRAGGING";
const CLASS_MAIN_NOT_DRAGGING = "CLASS_MAIN_NOT_DRAGGING";

const _log = getLogger("mainweb");

/**
 * This module has control of the window and is responsible for
 * starting up the main component and handling the window directly.
 */

let terminalIdCounter = 0;
let keyBindingManager: KeyBindingManager = null;
let themes: ThemeInfo[];
let mainWebUi: MainWebUi = null;
let configManager: ConfigDistributorImpl = null;
let extensionManager: ExtensionManager = null;
let commandPalette: PopDownListPicker<CommandMenuItem> = null;
let commandPaletteDisposable: Disposable = null;


/**
 * 
 */
export function startUp(closeSplash: () => void): void {
  if (process.platform === "darwin") {
    setupOSXEmptyMenus();
  }
  
  startUpTheming();
  startUpWebIpc();

  // Get the Config working.
  configManager = new ConfigDistributorImpl();
  keyBindingManager = new KeyBindingsManagerImpl();  // depends on the config.
  const themePromise = WebIpc.requestConfig().then( (msg: Messages.ConfigMessage) => {
    return handleConfigMessage(msg);
  });
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [themePromise, WebIpc.requestThemeList().then(handleThemeListMessage)] );
  allPromise.then(loadFontFaces)
            .then( () => {

    const doc = window.document;
    doc.body.classList.add(CLASS_MAIN_NOT_DRAGGING);

    startUpExtensions();
    startUpMainWebUi();

    closeSplash();

    startUpMainMenu();
    startUpResizeCanary();
    startUpCommandPalette();
    startUpWindowEvents();

    if (process.platform === "darwin") {
      setupOSXMenus(mainWebUi);
    }

    mainWebUi.newTerminalTab(null, configManager.getConfig().sessions[0].uuid);
    mainWebUi.focus();
    window.focus();
  });
}

function startUpTheming(): void {
  // Theme control for the window level.
  const topThemeable: ThemeTypes.Themeable = {
    setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {      
      (<HTMLStyleElement> document.getElementById('THEME_STYLE')).textContent =
        cssMap.get(ThemeTypes.CssFile.GUI_CONTROLS) + "\n" + 
        cssMap.get(ThemeTypes.CssFile.FONT_AWESOME) + "\n" + 
        cssMap.get(ThemeTypes.CssFile.TOP_WINDOW) + "\n" +
        cssMap.get(ThemeTypes.CssFile.TERMINAL_VARS) + "\n" +
        cssMap.get(ThemeTypes.CssFile.THEME_VARS)
        ;
    }
  };
  ThemeConsumer.registerThemeable(topThemeable);
}

function startUpWebIpc(): void {
  WebIpc.start();
  
  // Default handling for config messages.
  WebIpc.registerDefaultHandler(Messages.MessageType.CONFIG, handleConfigMessage);
  
  // Default handling for theme messages.
  WebIpc.registerDefaultHandler(Messages.MessageType.THEME_LIST, handleThemeListMessage);
  WebIpc.registerDefaultHandler(Messages.MessageType.THEME_CONTENTS, handleThemeContentsMessage);
  
  WebIpc.registerDefaultHandler(Messages.MessageType.DEV_TOOLS_STATUS, handleDevToolsStatus);
  
  WebIpc.registerDefaultHandler(Messages.MessageType.CLIPBOARD_READ, handleClipboardRead);
}  

function loadFontFaces(): Promise<FontFace[]> {
  // Next phase is wait for the fonts to load.
  const fontPromises: Promise<FontFace>[] = [];
  window.document.fonts.forEach( (font: FontFace) => {
    if (font.status !== 'loaded' && font.status !== 'loading') {
      fontPromises.push(font.load());
    }
  });
  return Promise.all<FontFace>( fontPromises );
}

function startUpMainWebUi(): void {
  mainWebUi = <MainWebUi>window.document.createElement(MainWebUi.TAG_NAME);
  injectConfigDistributor(mainWebUi, configManager);
  keybindingmanager.injectKeyBindingManager(mainWebUi, keyBindingManager);
  mainWebUi.setExtensionManager(extensionManager);
  mainWebUi.innerHTML = `<div class="tab_bar_rest">
    <div class="space"></div>
    <button id="${ID_MENU_BUTTON}" class="btn btn-quiet"><i class="fa fa-bars"></i></button>
    </div>`;

  mainWebUi.setThemes(themes);
  window.document.body.appendChild(mainWebUi);

  // Detect when the last tab has closed.
  mainWebUi.addEventListener(MainWebUi.EVENT_TAB_CLOSED, (ev: CustomEvent) => {
    if (mainWebUi.getTabCount() === 0) {
      WebIpc.windowCloseRequest();
    }
  });
  
  // Update the window title on request.
  mainWebUi.addEventListener(MainWebUi.EVENT_TITLE, (ev: CustomEvent) => {
    window.document.title = "Extraterm - " + ev.detail.title;
  });

  mainWebUi.addEventListener(MainWebUi.EVENT_MINIMIZE_WINDOW_REQUEST, () => {
    WebIpc.windowMinimizeRequest();
  });

  mainWebUi.addEventListener(MainWebUi.EVENT_MAXIMIZE_WINDOW_REQUEST, () => {
    WebIpc.windowMaximizeRequest();
  });

  mainWebUi.addEventListener(MainWebUi.EVENT_CLOSE_WINDOW_REQUEST, () => {
    WebIpc.windowCloseRequest();
  });

  mainWebUi.addEventListener(EVENT_DRAG_STARTED, (ev: CustomEvent): void => {
    window.document.body.classList.add(CLASS_MAIN_DRAGGING);
    window.document.body.classList.remove(CLASS_MAIN_NOT_DRAGGING);
  });

  mainWebUi.addEventListener(EVENT_DRAG_ENDED, (ev: CustomEvent): void => {
    window.document.body.classList.remove(CLASS_MAIN_DRAGGING);
    window.document.body.classList.add(CLASS_MAIN_NOT_DRAGGING);
  });

  mainWebUi.addEventListener(EVENT_COMMAND_PALETTE_REQUEST, handleCommandPaletteRequest);
}

function startUpMainMenu(): void {
  const contextMenuFragment = DomUtils.htmlToFragment(`
    <${ContextMenu.TAG_NAME} id="${ID_MAIN_MENU}">
        <${MenuItem.TAG_NAME} icon="fa fa-wrench" name="${MENU_ITEM_SETTINGS}">Settings</${MenuItem.TAG_NAME}>
        <${CheckboxMenuItem.TAG_NAME} icon="fa fa-cogs" id="${MENU_ITEM_DEVELOPER_TOOLS}" name="developer_tools">Developer Tools</${CheckboxMenuItem.TAG_NAME}>
        <${MenuItem.TAG_NAME} icon="far fa-lightbulb" name="${MENU_ITEM_ABOUT}">About</${MenuItem.TAG_NAME}>
    </${ContextMenu.TAG_NAME}>
  `);
  window.document.body.appendChild(contextMenuFragment)

  const mainMenu = window.document.getElementById(ID_MAIN_MENU);
  mainMenu.addEventListener('selected', (ev: CustomEvent) => {
    executeMenuCommand(ev.detail.name);
  });

  const menuButton = document.getElementById(ID_MENU_BUTTON);
  menuButton.addEventListener('click', () => {
    const contextMenu = <ContextMenu> document.getElementById(ID_MAIN_MENU);
    contextMenu.openAround(menuButton);
  });
}

function startUpResizeCanary(): void {
  // A special element for tracking when terminal fonts are effectively changed in the DOM.
  const resizeCanary = <ResizeCanary> window.document.createElement(ResizeCanary.TAG_NAME);
  resizeCanary.setCss(`
  font-family: var(--terminal-font);
  font-size: var(--default-terminal-font-size);
`);
  window.document.body.appendChild(resizeCanary);
  resizeCanary.addEventListener('resize', () => {
    mainWebUi.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
  });
}    

function startUpWindowEvents(): void {
  // Make sure something sensible is focussed if only the window gets the focus.
  window.addEventListener('focus', (ev: FocusEvent) => {
    if (ev.target === window) {
      mainWebUi.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (mainWebUi !== null) {
      mainWebUi.refresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);
    }
  });
  
  window.document.addEventListener('mousedown', (ev: MouseEvent) => {
    if (ev.which === 2) {
      WebIpc.clipboardReadRequest();
      
      // This is needed to stop the autoscroll blob from appearing on Windows.
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
  
  window.document.addEventListener('dragover', (ev: DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
  });
  window.document.addEventListener('drop', (ev: DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
  });
}

function startUpExtensions() {
  extensionManager = new ExtensionManagerImpl();
  extensionManager.startUp();
}

function executeMenuCommand(command: string): boolean {
  if (command === MENU_ITEM_DEVELOPER_TOOLS) {
    // Unflip what the user did to the state of the developer tools check box for a moment.
    // Let executeCommand() toggle the checkbox itself. 
    const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
    developerToolMenu.checked = ! developerToolMenu.checked;
  }

  return executeCommand(command);
}

function executeCommand(commandId: string, options?: object): boolean {
  switch(commandId) {
    case MENU_ITEM_SETTINGS:
      mainWebUi.openSettingsTab();
      break;
      
    case MENU_ITEM_DEVELOPER_TOOLS:
      const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
      developerToolMenu.checked = ! developerToolMenu.checked;
      WebIpc.devToolsRequest(developerToolMenu.checked);
      break;

    case MENU_ITEM_ABOUT:
      mainWebUi.openAboutTab();
      break;
      
    case MENU_ITEM_RELOAD_CSS:
      reloadThemeContents();
      break;

    default:
      return false;
  }
  return true;  
}

function setupOSXEmptyMenus(): void {
  const template: Electron.MenuItemOptions[] = [{
    label: "Extraterm",
  }];
  
  const emptyTopMenu = ElectronMenu.buildFromTemplate(template);
  ElectronMenu.setApplicationMenu(emptyTopMenu);  
}

function setupOSXMenus(mainWebUi: MainWebUi): void {
  const template: Electron.MenuItemOptions[] = [{
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
        type: 'separator'
      },
      {
        label: 'Quit',
        click(item, focusedWindow) {
          WebIpc.windowCloseRequest();
        },
        accelerator: 'Command+Q'
      }
    ]
  }];
  
  const topMenu = ElectronMenu.buildFromTemplate(template);
  
  ElectronMenu.setApplicationMenu(topMenu);
}

function handleConfigMessage(msg: Messages.Message): Promise<void> {
  const configMessage = <Messages.ConfigMessage> msg;
  const config = configMessage.config;
  configManager.setConfigFromMainProcess(config);
  return setupConfiguration(config);
}

function handleThemeListMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemeListMessage> msg;
  themes = themesMessage.themeInfo
}

function handleThemeContentsMessage(msg: Messages.Message): void {
  const themeContentsMessage = <Messages.ThemeContentsMessage> msg;

  const cssFileMap = new Map<ThemeTypes.CssFile, string>();
  for (const renderedCssFile of themeContentsMessage.themeContents.cssFiles) {
    cssFileMap.set(renderedCssFile.cssFileName, renderedCssFile.contents);
  }

  if (themeContentsMessage.errorMessage !== "") {
    _log.warn(themeContentsMessage.errorMessage);
  }

  // Distribute the CSS files to the classes which want them.
  ThemeConsumer.updateCss(cssFileMap);
}

function handleDevToolsStatus(msg: Messages.Message): void {
  const devToolsStatusMessage = <Messages.DevToolsStatusMessage> msg;
  const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
  if (developerToolMenu === null) {
    return;
  }
  developerToolMenu.checked = devToolsStatusMessage.open;
}

function handleClipboardRead(msg: Messages.Message): void {
  const clipboardReadMessage = <Messages.ClipboardReadMessage> msg;
  mainWebUi.pasteText(clipboardReadMessage.text);
}

//-------------------------------------------------------------------------

let oldConfig: Config = null;

function setupConfiguration(newConfig: Config): Promise<void> {
  const keyBindingContexts = keybindingmanager.loadKeyBindingsFromObject(newConfig.systemConfig.keyBindingsContexts,
    process.platform);

  if (! keyBindingContexts.equals(keyBindingManager.getKeyBindingsContexts())) {
    keyBindingManager.setKeyBindingsContexts(keyBindingContexts);
  }

  if (oldConfig === null ||
      oldConfig.systemConfig.originalScaleFactor !== newConfig.systemConfig.originalScaleFactor ||
      oldConfig.systemConfig.currentScaleFactor !== newConfig.systemConfig.currentScaleFactor ||
      oldConfig.uiScalePercent !== newConfig.uiScalePercent) {
    setRootFontScaleFactor(newConfig.systemConfig.originalScaleFactor, newConfig.systemConfig.currentScaleFactor, newConfig.uiScalePercent);
  }

  if (oldConfig === null || oldConfig.terminalFontSize !== newConfig.terminalFontSize ||
      oldConfig.terminalFont !== newConfig.terminalFont) {
        
    const matchingFonts = newConfig.systemConfig.availableFonts.filter(
      (font) => font.postscriptName === newConfig.terminalFont);

    const scaleFactor = newConfig.systemConfig.originalScaleFactor / newConfig.systemConfig.currentScaleFactor;
    const fontSizePx = Math.max(5, Math.round(newConfig.terminalFontSize * scaleFactor));
    setCssVars(newConfig.terminalFont, matchingFonts[0].path, fontSizePx);
  }

  if (oldConfig === null || oldConfig.themeTerminal !== newConfig.themeTerminal ||
      oldConfig.themeSyntax !== newConfig.themeSyntax ||
      oldConfig.themeGUI !== newConfig.themeGUI) {

    oldConfig = newConfig;
    return requestThemeContents();
  }

  oldConfig = newConfig;
  
  // no-op promise.
  return new Promise<void>( (resolve, cancel) => { resolve(); } );
}

async function requestThemeContents(): Promise<void> {
  const cssFileMap = new Map<ThemeTypes.CssFile, string>();

  const terminalResult = await WebIpc.requestThemeContents("terminal");
  if (terminalResult.success) {
    for (const renderedCssFile of terminalResult.themeContents.cssFiles) {
      cssFileMap.set(renderedCssFile.cssFileName, renderedCssFile.contents);
    }
  }
  if (terminalResult.errorMessage !== "") {
    _log.warn(terminalResult.errorMessage);
  }

  const syntaxResult = await WebIpc.requestThemeContents("syntax");
  if (syntaxResult.success) {
    for (const renderedCssFile of syntaxResult.themeContents.cssFiles) {
      cssFileMap.set(renderedCssFile.cssFileName, renderedCssFile.contents);
    }
  }
  if (syntaxResult.errorMessage !== "") {
    _log.warn(syntaxResult.errorMessage);
  }

  const uiResult = await WebIpc.requestThemeContents("gui");
  if (uiResult.success) {
    for (const renderedCssFile of uiResult.themeContents.cssFiles) {
      cssFileMap.set(renderedCssFile.cssFileName, renderedCssFile.contents);
    }
  }
  if (uiResult.errorMessage !== "") {
    _log.warn(uiResult.errorMessage);
  }
      
  // Distribute the CSS files to the classes which want them.
  ThemeConsumer.updateCss(cssFileMap);
}

function reloadThemeContents(): void {
  const config = configManager.getConfig();
  requestThemeContents();
}

function setCssVars(fontName: string, fontPath: string, terminalFontSizePx: number): void {
  const fontCssName = fontName.replace(/\W/g, "_");
  (<HTMLStyleElement> document.getElementById('CSS_VARS')).textContent =
    `
    @font-face {
      font-family: "${fontCssName}";
      src: url("${fontPath}");
    }

    :root {
      --default-terminal-font-size: ${terminalFontSizePx}px;
      --terminal-font: "${fontCssName}";
    }
    `;
}

function setRootFontScaleFactor(originalScaleFactor: number, currentScaleFactor: number, uiScalePercent: number): void {
  const dpiScaleFactor = originalScaleFactor / currentScaleFactor;
  const unitHeightPx = 12;

  const rootFontSize = Math.max(Math.floor(unitHeightPx * uiScalePercent * dpiScaleFactor / 100), 5) + "px";
  _log.debug("dpiScaleFactor:", dpiScaleFactor, "* uiScalePercent: ", uiScalePercent, " = rootFontSize: ",rootFontSize);
  window.document.documentElement.style.fontSize = rootFontSize;
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
let commandPaletteRequestSource: HTMLElement = null;
let commandPaletteRequestEntries: CommandEntry[] = null;

function startUpCommandPalette(): void {
  const doc = window.document;

  // Command palette
  commandPalette = <PopDownListPicker<CommandMenuItem>> doc.createElement(PopDownListPicker.TAG_NAME);
  commandPalette.id = ID_COMMAND_PALETTE;
  commandPalette.titlePrimary = "Command Palette";
  commandPalette.titleSecondary = "Ctrl+Shift+P";
  
  commandPalette.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
  commandPalette.setFormatEntriesFunc(commandPaletteFormatEntries);
  commandPalette.addExtraCss([ThemeTypes.CssFile.GUI_COMMANDPALETTE]);

  commandPalette.addEventListener('selected', handleCommandPaletteSelected);
}

function handleCommandPaletteRequest(ev: CustomEvent): void {
  const path = ev.composedPath();
  const requestCommandableStack: Commandable[] = <any> path.filter(el => isCommandable(el));

  doLater( () => {
    const commandableStack: Commandable[] = [...requestCommandableStack, {executeCommand, getCommandPaletteEntries}];
    
    const firstCommandable = commandableStack[0];
    if (firstCommandable instanceof HTMLElement) {
      commandPaletteRequestSource = firstCommandable;
    }

    commandPaletteRequestEntries = _.flatten(commandableStack.map(commandable => {
      let result: CommandEntry[] = commandable.getCommandPaletteEntries(commandableStack);
      if (commandable instanceof EtTerminal) {
        result = [...result, ...extensionManager.getWorkspaceTerminalCommands(commandable)];
      } else if (commandable instanceof TextViewer) {
        result = [...result, ...extensionManager.getWorkspaceTextViewerCommands(commandable)];
      }
      return result;
    }));

    const paletteEntries = commandPaletteRequestEntries.map( (entry, index): CommandMenuItem => {
      return {
        id: "" + index,
        group: entry.group,
        iconLeft: entry.iconLeft,
        iconRight: entry.iconRight,
        label: entry.label,
        shortcut: entry.shortcut
      };
    });
    
    const shortcut = keyBindingManager.getKeyBindingsContexts().context("main-ui").mapCommandToKeyBinding("openCommandPalette");
    commandPalette.titleSecondary = shortcut !== null ? shortcut : "";
    commandPalette.setEntries(paletteEntries);
    
    const contextElement = requestCommandableStack[requestCommandableStack.length-2];

    if (SupportsDialogStack.isSupportsDialogStack(contextElement)) {
      commandPaletteDisposable = contextElement.showDialog(commandPalette);
    
      commandPalette.open();
      commandPalette.focus();
    } else {
      _log.warn("Command palette context element doesn't support DialogStack. ", contextElement);
    }
  });
}

function getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
  const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
  const devToolsOpen = developerToolMenu.checked;
  const commandExecutor: CommandExecutor = {executeCommand};
  const commandList: CommandEntry[] = [
    { id: MENU_ITEM_SETTINGS, group: PALETTE_GROUP, iconRight: "fa fa-wrench", label: "Settings", commandExecutor },
    { id: MENU_ITEM_DEVELOPER_TOOLS, group: PALETTE_GROUP, iconLeft: devToolsOpen ? "far fa-check-square" : "far fa-square", iconRight: "fa fa-cogs", label: "Developer Tools", commandExecutor },
    { id: MENU_ITEM_RELOAD_CSS, group: PALETTE_GROUP, iconRight: "fa fa-sync", label: "Reload Theme", commandExecutor },
    { id: MENU_ITEM_ABOUT, group: PALETTE_GROUP, iconRight: "far fa-lightbulb", label: "About", commandExecutor },
  ];
  return commandList;
}

function handleCommandPaletteSelected(ev: CustomEvent): void {
  commandPalette.close();
  commandPaletteDisposable.dispose();
  commandPaletteDisposable = null;
  if (commandPaletteRequestSource !== null) {
    commandPaletteRequestSource.focus();
  }
  
  const selectedId = ev.detail.selected;
  if (selectedId !== null) {
    const commandIndex = Number.parseInt(selectedId);
    const commandEntry = commandPaletteRequestEntries[commandIndex];
    doLater( () => {
      commandEntry.commandExecutor.executeCommand(commandEntry.id, commandEntry.commandArguments);
      commandPaletteRequestSource = null;
      commandPaletteRequestEntries = null;
    });
  }
}

class ConfigDistributorImpl implements ConfigDistributor {
  private _config: Config = null;
  private _onChangeEventEmitter = new EventEmitter<void>();
  onChange: Event<void>;
  
  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
  }

  getConfig(): Config {
    return this._config;
  }
  
  setConfig(newConfig: Config): void {  
    if ( ! _.isEqual(this._config, newConfig)) {
      this._config = newConfig;
      WebIpc.sendConfig(newConfig);
      this._onChangeEventEmitter.fire(undefined);
<<<<<<< HEAD
    }
=======
    }    
>>>>>>> master
  }
  
  /**
   * Set a new configuration object as the application wide 
   */
  setConfigFromMainProcess(newConfig: Config): void {
    if ( ! _.isEqual(this._config, newConfig)) {
      this._config = newConfig;
      this._onChangeEventEmitter.fire(undefined);
    }
  }
}

class KeyBindingsManagerImpl implements KeyBindingManager {
  private _keyBindingsContexts: KeyBindingsContexts = null;

  private _onChangeEventEmitter = new EventEmitter<void>();
  onChange: Event<void>;
  
  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
  }

  getKeyBindingsContexts(): KeyBindingsContexts {
    return this._keyBindingsContexts;
  }
  
  setKeyBindingsContexts(newKeyBindingContexts: KeyBindingsContexts): void {
    this._keyBindingsContexts = newKeyBindingContexts;
    this._onChangeEventEmitter.fire(undefined);
  }
}
