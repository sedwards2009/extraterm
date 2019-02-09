/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, CustomizedCommand, SessionConfiguration} from 'extraterm-extension-api';
import * as Electron from 'electron';
import * as _ from 'lodash';
import * as SourceMapSupport from 'source-map-support';

const ElectronMenu = Electron.remote.Menu;

import {AboutTab} from './AboutTab';
import './gui/All'; // Need to load all of the GUI web components into the browser engine
import {CheckboxMenuItem} from './gui/CheckboxMenuItem';
import { CommandPalette } from "./command/CommandPalette";
import { EVENT_CONTEXT_MENU_REQUEST } from './command/CommandUtils';

import {ConfigDatabase, injectConfigDatabase, ConfigKey, SESSION_CONFIG, SystemConfig, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, ConfigChangeEvent} from '../Config';
import {ContextMenu} from './gui/ContextMenu';
import * as DomUtils from './DomUtils';
import {DropDown} from './gui/DropDown';
import {EmbeddedViewer} from './viewers/EmbeddedViewer';
import {ExtensionManagerImpl} from './extension/ExtensionManager';
import {ExtensionManager} from './extension/InternalTypes';
import {EVENT_DRAG_STARTED, EVENT_DRAG_ENDED} from './GeneralEvents';
import {Logger, getLogger} from "extraterm-logging";
import {MainWebUi} from './MainWebUi';
import {MenuItem} from './gui/MenuItem';
import {PopDownListPicker} from './gui/PopDownListPicker';
import {ResizeCanary} from './ResizeCanary';
import {SettingsTab} from './settings/SettingsTab';
import {TabWidget} from './gui/TabWidget';
import {EtTerminal} from './Terminal';
import {TerminalViewer} from './viewers/TerminalAceViewer';
import {TextViewer} from'./viewers/TextAceViewer';
import * as ThemeTypes from '../theme/Theme';
import * as ThemeConsumer from '../theme/ThemeConsumer';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';
import { EventEmitter } from '../utils/EventEmitter';
import { freezeDeep } from 'extraterm-readonly-toolbox';
import { log } from "extraterm-logging";
import { KeybindingsManager, injectKeybindingsManager, loadKeybindingsFromObject, TermKeybindingsMapping } from './keybindings/KeyBindingsManager';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ApplicationContextMenu } from "./command/ApplicationContextMenu";
import { registerCommands as TextCommandsRegisterCommands } from "./viewers/TextCommands";
import { DisposableHolder } from '../utils/DisposableUtils';
import { ExtensionCommandContribution, Category } from '../ExtensionMetadata';
import { EtViewerTab } from './ViewerTab';
import { isSupportsDialogStack } from './SupportsDialogStack';

type ThemeInfo = ThemeTypes.ThemeInfo;

SourceMapSupport.install();

const MENU_ITEM_DEVELOPER_TOOLS = 'developer_tools';
const ID_MAIN_MENU = "ID_MAIN_MENU";
const ID_MENU_BUTTON = "ID_MENU_BUTTON";
const CLASS_MAIN_DRAGGING = "CLASS_MAIN_DRAGGING";
const CLASS_MAIN_NOT_DRAGGING = "CLASS_MAIN_NOT_DRAGGING";

const _log = getLogger("mainweb");

/**
 * This module has control of the window and is responsible for
 * starting up the main component and handling the window directly.
 */

let keybindingsManager: KeybindingsManager = null;
let themes: ThemeInfo[];
let mainWebUi: MainWebUi = null;
let configDatabase: ConfigDatabaseImpl = null;
let extensionManager: ExtensionManager = null;
let commandPalette: CommandPalette = null;
let applicationContextMenu: ApplicationContextMenu = null;


export function startUp(closeSplash: () => void): void {
  if (process.platform === "darwin") {
    setupOSXEmptyMenus();
  }
  
  startUpTheming();
  startUpWebIpc();

  // Get the Config working.
  configDatabase = new ConfigDatabaseImpl();
  keybindingsManager = new KeybindingsManagerImpl();  // depends on the config.
  const configPromise = WebIpc.requestConfig("*").then( (msg: Messages.ConfigMessage) => {
    return handleConfigMessage(msg);
  });
  
  // Get the config and theme info in and then continue starting up.
  const allPromise = Promise.all<void>( [configPromise, WebIpc.requestThemeList().then(handleThemeListMessage)] );
  allPromise.then(loadFontFaces).then( () => {

    const doc = window.document;
    doc.body.classList.add(CLASS_MAIN_NOT_DRAGGING);

    startUpExtensions();
    startUpMainWebUi();
    registerCommands(extensionManager);
    startUpSessions(configDatabase, extensionManager);

    closeSplash();

    startUpMainMenu();
    startUpCommandPalette();
    startUpApplicationContextMenu();
    startUpWindowEvents();

    if (process.platform === "darwin") {
      setupOSXMenus(mainWebUi);
    }

    if (configDatabase.getConfig(SESSION_CONFIG).length !== 0) {
      mainWebUi.newTerminalTab(null, configDatabase.getConfig(SESSION_CONFIG)[0].uuid);
    } else {
      mainWebUi.commandOpenSettingsTab("session");
      Electron.remote.dialog.showErrorBox("No session types available",
        "Extraterm doesn't have any session types configured.");
    }
    mainWebUi.focus();
    window.focus();
  });
}

function startUpTheming(): void {
  // Theme control for the window level.
  const topThemeable: ThemeTypes.Themeable = {
    setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {      
      (<HTMLStyleElement> document.getElementById('THEME_STYLE')).textContent =
        cssMap.get(ThemeTypes.CssFile.GENERAL_GUI) + "\n" + 
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
  injectConfigDatabase(mainWebUi, configDatabase);
  injectKeybindingsManager(mainWebUi, keybindingsManager);
  mainWebUi.setExtensionManager(extensionManager);

  const systemConfig = <SystemConfig> configDatabase.getConfig(SYSTEM_CONFIG);
  const showWindowControls = systemConfig.titleBarStyle === "compact" && process.platform !== "darwin";
  let windowControls = "";
  if (showWindowControls) {
    windowControls = windowControlsHtml();
  }

  mainWebUi.innerHTML = trimBetweenTags(`<div class="tab_bar_rest">
    <div class="space"></div>
    <button id="${ID_MENU_BUTTON}" class="quiet"><i class="fa fa-bars"></i></button>
    ${windowControls}
    </div>`);

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

  if (showWindowControls) {
    setUpWindowControls();
  }

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

  mainWebUi.addEventListener(EVENT_CONTEXT_MENU_REQUEST, (ev: CustomEvent) => {
    extensionManager.updateExtensionWindowStateFromEvent(ev);
    applicationContextMenu.open(ev);
  });

  window.addEventListener("keydown", handleKeyDownCapture, true);
  window.addEventListener("keypress", handleKeyPressCapture, true);
  window.addEventListener("focus", handleFocusCapture, true);
  // ^ It would be nice to just have these on mainWebUi too, but bug
  // https://github.com/whatwg/dom/issues/685 prevents event capture on shadow DOM hosts from working as expected and
  // arriving in the right order wrt to things deeper in the tree. The fix arrives in Chrome 71.
}

function handleKeyDownCapture(ev: KeyboardEvent): void {
  _log.debug(`handleKeyDownCapture() event: `, ev);  
  handleKeyCapture(ev);
}

function handleKeyPressCapture(ev: KeyboardEvent): void {
  _log.debug(`handleKeyPressCapture() event: `, ev);  
  handleKeyCapture(ev);
}

function handleKeyCapture(ev: KeyboardEvent): void {
  const commands = keybindingsManager.getKeybindingsMapping().mapEventToCommands(ev);
_log.debug(`handleKeyCapture() commands '${commands}'`);  

  extensionManager.updateExtensionWindowStateFromEvent(ev);

  const categories: Category[] = extensionManager.isInputFieldFocus()
                                  ? ["application", "window"]
                                  : null;
  const filteredCommands = extensionManager.queryCommands({
    commandsWithCategories: commands.map(c => ({command: c.command, category: c.category })),
    categories: categories,
    when: true
  });
  if (filteredCommands.length !== 0) {
_log.debug(`filtered Commands is ${filteredCommands.map(fc => fc.command).join(", ")}`);

    if (filteredCommands.length !== 1) {
      _log.warn(`Commands ${filteredCommands.map(fc => fc.command).join(", ")} have conflicting keybindings.`);
    }

    extensionManager.executeCommand(filteredCommands[0].command);
    ev.stopPropagation();
    ev.preventDefault();
  }
}

function handleFocusCapture(ev: FocusEvent): void {
  extensionManager.updateExtensionWindowStateFromEvent(ev);
}

const ID_CONTROLS_SPACE = "ID_CONTROLS_SPACE";
const ID_MINIMIZE_BUTTON = "ID_MINIMIZE_BUTTON";
const ID_MAXIMIZE_BUTTON = "ID_MAXIMIZE_BUTTON";
const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";

function windowControlsHtml(): string {
  return trimBetweenTags(
    `<div id="${ID_CONTROLS_SPACE}"></div>
    <button id="${ID_MINIMIZE_BUTTON}" tabindex="-1"></button>
    <button id="${ID_MAXIMIZE_BUTTON}" tabindex="-1"></button>
    <button id="${ID_CLOSE_BUTTON}" tabindex="-1"></button>`);
}

function setUpWindowControls(): void {
  document.getElementById(ID_MINIMIZE_BUTTON).addEventListener('click', () => {
    WebIpc.windowMinimizeRequest();
  });

  document.getElementById(ID_MAXIMIZE_BUTTON).addEventListener('click', () => {
    WebIpc.windowMaximizeRequest();
  });

  document.getElementById(ID_CLOSE_BUTTON).addEventListener('click', () => {
    WebIpc.windowCloseRequest();
  });
}

function startUpMainMenu(): void {
  const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_MAIN_MENU}">
        <${MenuItem.TAG_NAME} icon="extraicon extraicon-pocketknife" data-command="extraterm:window.openSettings">Settings</${MenuItem.TAG_NAME}>
        <${CheckboxMenuItem.TAG_NAME} icon="fa fa-cogs" id="${MENU_ITEM_DEVELOPER_TOOLS}" data-command="extraterm:window.toggleDeveloperTools">Developer Tools</${CheckboxMenuItem.TAG_NAME}>
        <${MenuItem.TAG_NAME} icon="far fa-lightbulb" data-command="extraterm:window.openAbout">About</${MenuItem.TAG_NAME}>
    </${ContextMenu.TAG_NAME}>
  `));
  window.document.body.appendChild(contextMenuFragment)

  const mainMenu = window.document.getElementById(ID_MAIN_MENU);
  mainMenu.addEventListener('selected', (ev: CustomEvent) => {
    extensionManager.executeCommand((<HTMLElement> ev.detail.menuItem).getAttribute("data-command"));
  });

  const menuButton = document.getElementById(ID_MENU_BUTTON);
  menuButton.addEventListener('click', () => {
    const contextMenu = <ContextMenu> document.getElementById(ID_MAIN_MENU);
    contextMenu.openAround(menuButton);
  });
}

function startUpWindowEvents(): void {
  // Make sure something sensible is focussed if only the window gets the focus.
  window.addEventListener('focus', (ev: FocusEvent) => {
    if (ev.target === window) {
      mainWebUi.focus();
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

function registerCommands(extensionManager: ExtensionManager): void {
  const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
  commands.registerCommand("extraterm:window.toggleDeveloperTools", commandToogleDeveloperTools,
                            customizeToogleDeveloperTools);
  commands.registerCommand("extraterm:window.reloadCss", commandReloadThemeContents);
  commands.registerCommand("extraterm:application.openCommandPalette", commandOpenCommandPalette);

  EtTerminal.registerCommands(extensionManager);
  TextCommandsRegisterCommands(extensionManager);
  EtViewerTab.registerCommands(extensionManager);

  extensionManager.getExtensionContextByName("internal-commands").debugRegisteredCommands();
}

function startUpSessions(configDatabase: ConfigDatabaseImpl, extensionManager: ExtensionManager): void {
  const disposables = new DisposableHolder();

  const createSessionCommands = (sessionConfigs: SessionConfiguration[]): void => {
    const extensionContext = extensionManager.getExtensionContextByName("internal-commands");

    for (const session of sessionConfigs) {
      const args = {
        sessionUuid: session.uuid
      };
      const contrib: ExtensionCommandContribution = {
        command: "extraterm:window.newTerminal?" + encodeURIComponent(JSON.stringify(args)),
        title: "New Terminal: " + session.name,
        category: "window",
        order: 1000,
        when: "",
        icon: "fa fa-plus",
        contextMenu: true,
        commandPalette: true,
        emptyPaneMenu: true,
        newTerminalMenu: true
      };
      disposables.add(extensionContext.registerCommandContribution(contrib));
    }
  };

  configDatabase.onChange(event => {
    if (event.key === SESSION_CONFIG) {
      disposables.dispose();
      createSessionCommands(event.newConfig);
    }
  });

  const sessionConfig = <SessionConfiguration[]> configDatabase.getConfig(SESSION_CONFIG);
  createSessionCommands(sessionConfig);
}

function commandToogleDeveloperTools(): void {
  const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
  WebIpc.devToolsRequest(developerToolMenu.checked);
}

function customizeToogleDeveloperTools(): CustomizedCommand {
  const developerToolMenu = <CheckboxMenuItem> document.getElementById("developer_tools");
  return {
    checked: developerToolMenu.checked
  };
}

function commandReloadThemeContents(): void {
  reloadThemeContents();
}

function commandOpenCommandPalette(): void {
  const tab = extensionManager.getActiveTabContent();
  if (isSupportsDialogStack(tab)) {
    commandPalette.open(tab, tab);
  }
}

function setupOSXEmptyMenus(): void {
  const template: Electron.MenuItemConstructorOptions[] = [{
    label: "Extraterm",
  }];
  
  const emptyTopMenu = ElectronMenu.buildFromTemplate(template);
  ElectronMenu.setApplicationMenu(emptyTopMenu);  
}

function setupOSXMenus(mainWebUi: MainWebUi): void {
  const template: Electron.MenuItemConstructorOptions[] = [{
    label: "Extraterm",
    submenu: [
      {
        label: 'About Extraterm',
        click(item, focusedWindow) {
          extensionManager.executeCommand("extraterm:window.openAbout");
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'Preferences...',
        click(item, focusedWindow) {
          extensionManager.executeCommand("extraterm:window.openSettings");
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
  const key = configMessage.key;
  configDatabase.setConfigFromMainProcess(key, configMessage.config);
  if ([GENERAL_CONFIG, SYSTEM_CONFIG, "*"].indexOf(key) !== -1) {
    return setupConfiguration();
  } else {
    return new Promise<void>( (resolve, cancel) => { resolve(); } );
  }
}

function handleThemeListMessage(msg: Messages.Message): void {
  const themesMessage = <Messages.ThemeListMessage> msg;
  themes = themesMessage.themeInfo;
  if (mainWebUi != null) {
    mainWebUi.setThemes(themes);
  }
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
let oldSystemConfig: SystemConfig = null;
let oldGeneralConfig: GeneralConfig = null;

async function setupConfiguration(): Promise<void> {
  const newSystemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  const newGeneralConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);

  const keybindingsFile = loadKeybindingsFromObject(newSystemConfig.keybindingsFile, process.platform);
  if (! keybindingsFile.equals(keybindingsManager.getKeybindingsMapping())) {
    keybindingsManager.setKeybindingsMapping(keybindingsFile);
  }

  if (oldSystemConfig === null ||
      oldSystemConfig.originalScaleFactor !== newSystemConfig.originalScaleFactor ||
      oldSystemConfig.currentScaleFactor !== newSystemConfig.currentScaleFactor ||
      oldGeneralConfig.uiScalePercent !== newGeneralConfig.uiScalePercent) {
    setRootFontScaleFactor(newSystemConfig.originalScaleFactor, newSystemConfig.currentScaleFactor, newGeneralConfig.uiScalePercent);
  }

  if (oldGeneralConfig === null || oldGeneralConfig.terminalFontSize !== newGeneralConfig.terminalFontSize ||
      oldGeneralConfig.terminalFont !== newGeneralConfig.terminalFont) {
        
    const matchingFonts = newSystemConfig.availableFonts.filter(
      (font) => font.postscriptName === newGeneralConfig.terminalFont);

    const scaleFactor = newSystemConfig.originalScaleFactor / newSystemConfig.currentScaleFactor;
    const fontSizePx = Math.max(5, Math.round(newGeneralConfig.terminalFontSize * scaleFactor));
    setCssVars(newGeneralConfig.terminalFont, matchingFonts[0].path, fontSizePx);
  }


  if (oldGeneralConfig == null) {
    oldGeneralConfig = newGeneralConfig;
    oldSystemConfig = newSystemConfig;
    await requestThemeContents();
  } else {
    const refreshThemeTypeList: ThemeTypes.ThemeType[] = [];
    if (oldGeneralConfig.themeTerminal !== newGeneralConfig.themeTerminal) {
      refreshThemeTypeList.push("terminal");
    }
    if (oldGeneralConfig.themeSyntax !== newGeneralConfig.themeSyntax) {
      refreshThemeTypeList.push("syntax");
    }

    if (oldGeneralConfig.themeGUI !== newGeneralConfig.themeGUI ||
        oldGeneralConfig.terminalMarginStyle !== newGeneralConfig.terminalMarginStyle) {
      refreshThemeTypeList.push("gui");
    }

    oldGeneralConfig = newGeneralConfig;
    oldSystemConfig = newSystemConfig;
    if (refreshThemeTypeList.length !== 0) {
      await requestThemeContents(refreshThemeTypeList);
    }
  }

  oldGeneralConfig = newGeneralConfig;
  oldSystemConfig = newSystemConfig;
}

async function requestThemeContents(refreshThemeTypeList: ThemeTypes.ThemeType[] = []): Promise<void> {
  const cssFileMap = new Map<ThemeTypes.CssFile, string>(ThemeConsumer.cssMap());

  const neededThemeTypes = new Set<ThemeTypes.ThemeType>(refreshThemeTypeList);
  if (refreshThemeTypeList.length === 0) {
    neededThemeTypes.add("terminal");
    neededThemeTypes.add("gui");
    neededThemeTypes.add("syntax");
  } else {
    if (refreshThemeTypeList.indexOf("terminal") !== -1) {
      // GUI theme can also depend on the terminal theme. Thus, rerender.
      neededThemeTypes.add("gui");
    }
  }

  for (const themeType of neededThemeTypes) {
    const renderResult = await WebIpc.requestThemeContents(themeType);
    if (renderResult.success) {
      for (const renderedCssFile of renderResult.themeContents.cssFiles) {
        cssFileMap.set(renderedCssFile.cssFileName, renderedCssFile.contents);
      }
    }
    if (renderResult.errorMessage !== "") {
      _log.warn(renderResult.errorMessage);
    }
  }

  // Distribute the CSS files to the classes which want them.
  ThemeConsumer.updateCss(cssFileMap);
}

function reloadThemeContents(): void {
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

function startUpCommandPalette(): void {
  commandPalette = new CommandPalette(extensionManager, keybindingsManager);
}

function startUpApplicationContextMenu(): void {
  applicationContextMenu = new ApplicationContextMenu(extensionManager, keybindingsManager);
}

class ConfigDatabaseImpl implements ConfigDatabase {
  private _configDb = new Map<ConfigKey, any>();
  private _onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;
  private _log: Logger;

  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
    this._log = getLogger("ConfigDatabaseImpl", this);
  }

  getConfig(key: ConfigKey): any {
    const result = this._getConfigNoWarnings(key);
    if (result == null) {
      this._log.warn("Unable to find config for key ", key);
    } else {
      return result;
    }
  }

  _getConfigNoWarnings(key: ConfigKey): any {
    if (key === "*") {
      // Wildcard fetch all.
      const result = {};

      for (const [dbKey, value] of this._configDb.entries()) {
        result[dbKey] = value;
      }
      freezeDeep(result);
      return result;
    } else {
      return this._configDb.get(key);
    }
  }

  getConfigCopy(key: ConfigKey): any {
    const data = this.getConfig(key);
    if (data == null) {
      return null;
    }
    return _.cloneDeep(data);
  }
  
  setConfig(key: ConfigKey, newConfig: any): void {
    if ( ! this._setConfigNoWrite(key, newConfig)) {
      return;
    }

    WebIpc.sendConfig(key, newConfig);
  }

  setConfigFromMainProcess(key: ConfigKey, newConfig: any): void {
    this._setConfigNoWrite(key, newConfig);
  }

  private _setConfigNoWrite(key: ConfigKey, newConfig: any): boolean {
    if (key === "*") {
      let changed = false;
      for (const objectKey of Object.getOwnPropertyNames(newConfig)) {
        changed = this._setSingleConfigNoWrite(<ConfigKey> objectKey, newConfig[objectKey]) || changed;
      }
      return changed;
    } else {
      return this._setSingleConfigNoWrite(key, newConfig);
    }
  }

  private _setSingleConfigNoWrite(key: ConfigKey, newConfig: any): boolean {
    const oldConfig = this._getConfigNoWarnings(key);
    if (_.isEqual(oldConfig, newConfig)) {
      return false;
  }
  
    if (Object.isFrozen(newConfig)) {
      this._configDb.set(key, newConfig);
    } else {
      this._configDb.set(key, freezeDeep(_.cloneDeep(newConfig)));
    }

    this._onChangeEventEmitter.fire({key, oldConfig, newConfig: this.getConfig(key)});
    return true;
  }
}

class KeybindingsManagerImpl implements KeybindingsManager {
  private _keybindingsMapping: TermKeybindingsMapping = null;
  private _log: Logger;
  private _onChangeEventEmitter = new EventEmitter<void>();
  onChange: Event<void>;
  private _enabled = true;

  constructor() {
    this._log = getLogger("KeybindingsManagerImpl", self);
    this.onChange = this._onChangeEventEmitter.event;
  }

  getKeybindingsMapping(): TermKeybindingsMapping {
    return this._keybindingsMapping;
  }
  
  setKeybindingsMapping(newKeybindingContexts: TermKeybindingsMapping): void {
    this._keybindingsMapping = newKeybindingContexts;
    this._keybindingsMapping.setEnabled(this._enabled);
    this._onChangeEventEmitter.fire(undefined);
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (this._keybindingsMapping != null) {
      this._keybindingsMapping.setEnabled(this._enabled);
    }

    WebIpc.enableGlobalKeybindings(enabled);
  }
}
