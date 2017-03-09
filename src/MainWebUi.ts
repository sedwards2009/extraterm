/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from './DomUtils';
import * as util from './gui/Util';
import {ThemeableElementBase} from './ThemeableElementBase';
import {TabWidget as TabWidget} from './gui/TabWidget';
import {EtTerminal} from './Terminal';
import {SettingsTab} from './settings/SettingsTab';
import {AboutTab} from './AboutTab';
import {EtKeyBindingsTab} from './KeyBindingsTab';
import {EtViewerTab} from './ViewerTab';
import {EmbeddedViewer} from './EmbeddedViewer';
import {Tab} from './gui/Tab';
import {ViewerElement} from './ViewerElement';
import * as ViewerElementTypes from './ViewerElementTypes';
import * as BulkDomOperation from './BulkDomOperation';
import * as ThemeTypes from './Theme';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';
import * as CodeMirrorOperation from './CodeMirrorOperation';

import * as CommandPaletteTypes from './gui/CommandPaletteTypes';
import * as CommandPaletteRequestTypes from './CommandPaletteRequestTypes';
type CommandPaletteRequest = CommandPaletteRequestTypes.CommandPaletteRequest;

import * as InternalExtratermApi from './InternalExtratermApi';

import * as WebIpc from './WebIpc';
import * as Messages from './WindowMessages';
import * as path from 'path';
import * as _ from 'lodash';

import * as config from './Config';
type Config = config.Config;
type ConfigManager =config.ConfigManager;
type SessionProfile = config.SessionProfile;

import * as he from 'he';
import {FrameFinder} from './FrameFinderType';

import * as keybindingmanager from './KeyBindingManager';
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import * as GeneralEvents from './GeneralEvents';
import Logger from './Logger';
import LogDecorator from './LogDecorator';
const log = LogDecorator;

const VisualState = ViewerElementTypes.VisualState;

const ID = "ExtratermMainWebUITemplate";

const ID_TOP_LAYOUT = "ID_TOP_LAYOUT";
const ID_MAIN_CONTENTS = "ID_MAIN_CONTENTS";
const ID_TITLE_BAR = "ID_TITLE_BAR";
const ID_TITLE_BAR_SPACE = "ID_TITLE_BAR_SPACE";
const ID_DRAG_BAR = "ID_DRAG_BAR";
const ID_TOP_RESIZE_BAR = "ID_TOP_RESIZE_BAR";
const ID_MINIMIZE_BUTTON = "ID_MINIMIZE_BUTTON";
const ID_MAXIMIZE_BUTTON = "ID_MAXIMIZE_BUTTON";
const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";
const ID_OSX_MINIMIZE_BUTTON = "ID_OSX_MINIMIZE_BUTTON";
const ID_OSX_MAXIMIZE_BUTTON = "ID_OSX_MAXIMIZE_BUTTON";
const ID_OSX_CLOSE_BUTTON = "ID_OSX_CLOSE_BUTTON";

const ID_PANE_LEFT = "ID_PANE_LEFT";
const ID_PANE_RIGHT = "ID_PANE_RIGHT";
const ID_GAP = "ID_GAP";
const ID_TAB_CONTAINER_LEFT = "ID_TAB_CONTAINER_LEFT";
const ID_REST_DIV_PRIMARY = "ID_REST_DIV_PRIMARY";
const ID_REST_DIV_LEFT = "ID_REST_DIV_LEFT";
const ID_REST_DIV_SECONDARY = "ID_REST_DIV_SECONDARY";
const ID_LEFT_REST_DIV_SECONDARY = "ID_LEFT_REST_DIV_SECONDARY";
const ID_NEW_TAB_BUTTON_PRIMARY = "ID_NEW_TAB_BUTTON_PRIMARY";

const CLASS_SPLIT = "split";

const CLASS_TAB_HEADER_CONTAINER = "tab_header_container";
const CLASS_TAB_HEADER_ICON = "tab_header_icon";
const CLASS_TAB_HEADER_MIDDLE = "tab_header_middle";
const CLASS_TAB_HEADER_CLOSE = "tab_header_close";

const KEYBINDINGS_MAIN_UI = "main-ui";
const PALETTE_GROUP = "mainwebui";
const COMMAND_SELECT_TAB_LEFT = "selectTabLeft";
const COMMAND_SELECT_TAB_RIGHT = "selectTabRight";
const COMMAND_NEW_TAB = "newTab";
const COMMAND_CLOSE_TAB = "closeTab";

let registered = false;

enum TabType {
  TERMINAL,
  VIEWER
}

/**
 * Class for holding info about the contents of our tabs.
 */
class TabInfo {
  
  id: number;
  
  contentDiv: HTMLDivElement;
  
  tab: Tab;
  
  constructor() {
  }
  
  wasShown: boolean = false;
  
  lastFocus: boolean = false; // True if this tab had the focus last.
  
  focus(): void { }
    
  destroy(): void { }
  
  getFrameContents(frameId: string): string {
    return null;
  }  
}

/**
 * A tab which contains a terminal.
 */
class TerminalTabInfo extends TabInfo {
  
  constructor(configManager: ConfigManager, public terminal: EtTerminal, public ptyId: number) {
    super();
    const config = configManager.getConfig();
    this.terminal.setBlinkingCursor(config.blinkingCursor);
    this.terminal.setScrollbackSize(config.scrollbackLines);
  }
  
  focus(): void {
    this.terminal.resizeToContainer();
    this.terminal.focus();
  }
    
  destroy(): void {
    this.terminal.destroy();
    
    if (this.ptyId !== null) {
      WebIpc.ptyClose(this.ptyId);
    }
  }
  
  getFrameContents(frameId: string): string {
    return this.terminal.getFrameContents(frameId);
  }
}

/**
 * A tab which contains a viewer.
 */
class ViewerElementTabInfo extends TabInfo {
  constructor(public viewerElement: ViewerElement) {
    super();
  }
  
  focus(): void {
    this.viewerElement.focus();
  }
}

class ViewerTabInfo extends ViewerElementTabInfo {
  constructor(public viewer: EtViewerTab) {
    super(viewer);
  }
  
  getFrameContents(frameId: string): string {
    if (this.viewer.tag === frameId) {
      return this.viewer.getFrameContents(frameId);
    } else {
      return null;
    }
  }
}

class SettingsTabInfo extends ViewerElementTabInfo {
  constructor(public settingsElement: SettingsTab, public themes: ThemeTypes.ThemeInfo[]) {
    super(settingsElement);
    settingsElement.setThemes(themes);
  }
}

// These classes act as markers for use with 'instanceof'.
class AboutTabInfo extends ViewerElementTabInfo {
  constructor(public aboutElement: AboutTab) {
    super(aboutElement);
  }
}

// These classes act as markers for use with 'instanceof'.
class KeyBindingsTabInfo extends ViewerElementTabInfo {
  constructor(public keyBindingsElement: EtKeyBindingsTab) {
    super(keyBindingsElement);
  }
}

const staticLog = new Logger("Static ExtratermMainWebUI");

// Theme management
const activeInstances: Set<MainWebUi> = new Set();
let themeCss = "";

/**
 * Top level UI component for a normal terminal window
 *
 */
export class MainWebUi extends ThemeableElementBase implements keybindingmanager.AcceptsKeyBindingManager,
    config.AcceptsConfigManager {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static init(): void {
    Tab.init();
    TabWidget.init();
    EtTerminal.init();
    SettingsTab.init();
    EtKeyBindingsTab.init();
    AboutTab.init();
    EtViewerTab.init();
    
    if (registered === false) {
      window.document.registerElement(MainWebUi.TAG_NAME, {prototype: MainWebUi.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME = 'EXTRATERM-MAINWEBUI';
  
  static EVENT_TAB_OPENED = 'mainwebui-tab-opened';
  
  static EVENT_TAB_CLOSED = 'mainwebui-tab-closed';
  
  static EVENT_TITLE = 'mainwebui-title';

  static EVENT_MINIMIZE_WINDOW_REQUEST = "mainwebui-minimize-window-request";

  static EVENT_MAXIMIZE_WINDOW_REQUEST = "mainwebui-maximize-window-request";

  static EVENT_CLOSE_WINDOW_REQUEST = "mainwebui-close-window-request";

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _tabInfo: TabInfo[];
  
  private _tabIdCounter: number;
  
  private _configManager: ConfigManager;
  
  private _keyBindingManager: KeyBindingManager;

  private _themes: ThemeTypes.ThemeInfo[];

  private _internalExtratermApi: InternalExtratermApi.InternalExtratermApi;

  private _initProperties(): void {
    this._log = new Logger("ExtratermMainWebUI", this);
    this._tabInfo = [];
    this._tabIdCounter = 0;
    this._configManager = null;
    this._keyBindingManager = null;
    this._themes = [];
    this._internalExtratermApi = null;
  }
  
  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------
  
  /**
   * Custom element API call back.
   */
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
  }
  
  attachedCallback(): void {
    super.attachedCallback();

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    // Update the window title when the selected tab changes and resize the terminal.
    const tabWidgetLeft = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    tabWidgetLeft.addEventListener(TabWidget.EVENT_TAB_SWITCH, (e) => {
      this._handleTabSwitch(tabWidgetLeft);
    });

    const newTabPrimaryButton = this._getById(ID_NEW_TAB_BUTTON_PRIMARY);
    newTabPrimaryButton.addEventListener('click', () => {
      this.focusTab(this.newTerminalTab());
    });
    
    const closeButtenHandler = () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MINIMIZE_WINDOW_REQUEST);
    };
    this._getById(ID_MINIMIZE_BUTTON).addEventListener('click', closeButtenHandler);
    this._getById(ID_OSX_MINIMIZE_BUTTON).addEventListener('click', closeButtenHandler);

    const maximizeButtonHandler = () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MAXIMIZE_WINDOW_REQUEST);
    };
    this._getById(ID_MAXIMIZE_BUTTON).addEventListener('click', maximizeButtonHandler);
    this._getById(ID_OSX_MAXIMIZE_BUTTON).addEventListener('click', maximizeButtonHandler);

    const closeButtonHandler = () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_CLOSE_WINDOW_REQUEST);
    };
    this._getById(ID_CLOSE_BUTTON).addEventListener('click', closeButtonHandler);
    this._getById(ID_OSX_CLOSE_BUTTON).addEventListener('click', closeButtonHandler);

    this._setupIpc();
  }

  private _createClone(): Node {
    var template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _html(): string {
    return `
    <style id="${ThemeableElementBase.ID_THEME}"></style>` +
    `<div id="${ID_TOP_LAYOUT}">` +
      `<div id="${ID_TITLE_BAR}">` +
        `<div id="${ID_TITLE_BAR_SPACE}">` +
          `<div id="${ID_TOP_RESIZE_BAR}"></div>` +
          `<div id="${ID_DRAG_BAR}"></div>` +
        `</div>` +
        `<button id="${ID_MINIMIZE_BUTTON}" tabindex="-1"></button>` +
        `<button id="${ID_MAXIMIZE_BUTTON}" tabindex="-1"></button>` +
        `<button id="${ID_CLOSE_BUTTON}" tabindex="-1"></button>` +
      `</div>` +
      `<div id="${ID_MAIN_CONTENTS}">` +
        `<div id="${ID_PANE_LEFT}">` +
          `<${TabWidget.TAG_NAME} id="${ID_TAB_CONTAINER_LEFT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_LEFT}">` +
              `<button id="${ID_OSX_CLOSE_BUTTON}" tabindex="-1"></button>` +
              `<button id="${ID_OSX_MINIMIZE_BUTTON}" tabindex="-1"></button>` +
              `<button id="${ID_OSX_MAXIMIZE_BUTTON}" tabindex="-1"></button>` +
            `</div>` +
            `<div id="${ID_REST_DIV_PRIMARY}"><button class="btn btn-quiet" id="${ID_NEW_TAB_BUTTON_PRIMARY}"><i class="fa fa-plus"></i></button>` +
            `<slot></slot></div>` +
          `</${TabWidget.TAG_NAME}>` +
        `</div>` +
      `</div>` +
    `</div>`;
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.MAIN_UI];
  }

  destroy(): void {
  }
  
  //-----------------------------------------------------------------------
  
  focus(): void {
    // Put the focus onto the last terminal that had the focus.
    const lastFocus = this._tabInfo.filter( tabInfo => tabInfo.lastFocus );
    if (lastFocus.length !== 0) {
      lastFocus[0].focus();
    } else {
      if (this._tabInfo.length !==0) {
        this._tabInfo[0].focus();
      }
    }
  }
  
  private _handleTabSwitch(tabWidget: TabWidget): void {
    const tabInfos = this._tabInfo;

    const tabInfo = tabInfos[tabWidget.getCurrentIndex()];
    
    const el = tabWidget.getCurrentTab().nextElementSibling;
    let title = "";
    if (el instanceof EtTerminal) {
      title = el.getTerminalTitle();
    } else if (el instanceof ViewerElement) {
      title = el.title;
    } else if (el instanceof EtViewerTab) {        
      title = el.title;
    }

    this._sendTitleEvent(title);
    tabInfo.focus();
  }

  setInternalExtratermApi(api: InternalExtratermApi.InternalExtratermApi): void {
    this._internalExtratermApi = api;
    api.setTopLevel(this);
  }

  setConfigManager(configManager: ConfigManager): void {
    this._configManager = configManager;
  }
  
  setKeyBindingManager(keyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = keyBindingManager;
  }
  
  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._themes = themes;
  }
  
  getTabCount(): number {
    return this._tabInfo.length;
  }
  
  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._refresh(level);
  }

  /**
   * Initialise and insert a tab.
   * 
   * @param {TabInfo}     tabInfo  Object describing the tab.
   */
  private _addTab(tabInfo: TabInfo): void {
    const newId = this._tabIdCounter;
    this._tabIdCounter++;
    const newTab = <Tab> document.createElement(Tab.TAG_NAME);
    newTab.setAttribute('id', "tab_id_"+newId);
    newTab.innerHTML =
      `<div class="${CLASS_TAB_HEADER_CONTAINER}">` +
        `<div class="${CLASS_TAB_HEADER_ICON}"></div>` +
        `<div class="${CLASS_TAB_HEADER_MIDDLE}">${newId}</div>` +
        `<div class="${CLASS_TAB_HEADER_CLOSE}">` +
          `<button id="close_tag_id_${newId}"><i class="fa fa-times"></i></button>` +
        `</div>` +
      `</div>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('tab_content');
    
    tabInfo.id = newId;
    tabInfo.tab = newTab;
    tabInfo.contentDiv = contentDiv;
    this._tabInfo.push(tabInfo);
    
    const tabWidget = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
                        
    // The way the split view changes the position of the 'rest' controls
    // in the tab widgets causes this expression below.
    const restDiv = this._getById(ID_REST_DIV_PRIMARY);
    
    tabWidget.insertBefore(newTab, restDiv);
    tabWidget.insertBefore(contentDiv, restDiv);
    tabWidget.update();
    
    const closeTabButton = DomUtils.getShadowRoot(this).getElementById("close_tag_id_" + newId);
    closeTabButton.addEventListener('click', (ev: MouseEvent): void => {
      this.closeTab(tabInfo.id);
    });
    
    // Key press event
    tabInfo.contentDiv.addEventListener('keydown', this._handleKeyDownCapture.bind(this, tabInfo), true);
    
    tabInfo.contentDiv.addEventListener(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, (ev: CustomEvent) => {
      this._handleCommandPaletteRequest(tabInfo, ev);
    });
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(): number {
    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    config.injectConfigManager(newTerminal, this._configManager);
    keybindingmanager.injectKeyBindingManager(newTerminal, this._keyBindingManager);
    newTerminal.setFrameFinder(this._frameFinder.bind(this));
    const tabInfo = new TerminalTabInfo(this._configManager, newTerminal, null);
    this._addTab(tabInfo);
    
    tabInfo.contentDiv.appendChild(newTerminal);
    
    newTerminal.addEventListener('focus', (ev: FocusEvent) => {
      this._tabInfo.forEach( tabInfo2 => {
        tabInfo2.lastFocus = tabInfo2 === tabInfo;
      });
    });
    
    // User input event
    newTerminal.addEventListener(EtTerminal.EVENT_USER_INPUT, (ev: CustomEvent): void => {
      if (tabInfo.ptyId !== null) {
        WebIpc.ptyInput(tabInfo.ptyId, (<any> ev).detail.data);
      }
    });
    
    let currentColumns = newTerminal.getColumns();
    let currentRows = newTerminal.getRows();

    // Terminal resize event
    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_RESIZE, (ev: CustomEvent): void => {
      currentColumns = (<any> ev).detail.columns;
      currentRows = (<any> ev).detail.rows;
      if (tabInfo.ptyId !== null) {
        WebIpc.ptyResize(tabInfo.ptyId, currentColumns, currentRows);
      }
    });

    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_BUFFER_SIZE, (ev: CustomEvent): void => {
      const status: { bufferSize: number;} = <any> ev.detail;
      if(tabInfo.ptyId != null) {
        WebIpc.ptyOutputBufferSize(tabInfo.ptyId, status.bufferSize);
      }
    });

    // Terminal title event
    newTerminal.addEventListener(EtTerminal.EVENT_TITLE, (ev: CustomEvent): void => {
      this._updateTabTitle(newTerminal);
      this._sendTitleEvent(ev.detail.title);
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT, (ev: CustomEvent): void => {
      this.focusTab(this.openViewerTab(ev.detail.embeddedViewer, ev.detail.terminal.getFontAdjust()));
      ev.detail.terminal.deleteEmbeddedViewer(ev.detail.embeddedViewer);
    });
    
    const sessionProfile = this._configManager.getConfig().expandedProfiles[0];
    const newEnv = _.cloneDeep(process.env);
    const expandedExtra = sessionProfile.extraEnv;

    let prop: string;
    for (prop in expandedExtra) {
      newEnv[prop] = expandedExtra[prop];
    }
    
    WebIpc.requestPtyCreate(sessionProfile.command, sessionProfile.arguments,
        currentColumns, currentRows, newEnv)
      .then( (msg: Messages.CreatedPtyMessage) => {
        tabInfo.ptyId = msg.id;
        WebIpc.ptyResize(tabInfo.ptyId, currentColumns, currentRows);
        WebIpc.ptyOutputBufferSize(tabInfo.ptyId, 1024);  // Just big enough to get things started. We don't need the exact buffer size.
      });

    this._updateTabTitle(newTerminal);
    this._sendTabOpenedEvent();

    this._internalExtratermApi.addTab(newTerminal);
    return tabInfo.id;
  }
  
  openViewerTab(embeddedViewer: EmbeddedViewer, fontAdjust: number): number {
    const viewerElement = embeddedViewer.getViewerElement();
    const viewerTab = <EtViewerTab> document.createElement(EtViewerTab.TAG_NAME);
    viewerTab.setFontAdjust(fontAdjust);
    keybindingmanager.injectKeyBindingManager(viewerTab, this._keyBindingManager);
    viewerTab.title = embeddedViewer.title;
    viewerTab.tag = embeddedViewer.getTag();
    
    const tabInfo = new ViewerTabInfo(viewerTab);
    viewerElement.setMode(ViewerElementTypes.Mode.CURSOR);
    viewerElement.setVisualState(VisualState.AUTO);
    const result = this._openViewerTabInfo(tabInfo, viewerTab);
    viewerTab.setViewerElement(viewerElement);

    this._updateTabTitle(viewerTab);

    return result;
  }
  
  private _openViewerTabInfo(tabInfo: ViewerElementTabInfo, viewerElement: ViewerElement): number {
    viewerElement.setFocusable(true);
    this._addTab(tabInfo);
    tabInfo.contentDiv.appendChild(viewerElement);

    viewerElement.addEventListener('focus', (ev: FocusEvent) => {
      this._tabInfo.forEach( tabInfo2 => {
        tabInfo2.lastFocus = tabInfo2 === tabInfo;
      });
    });

    this._updateTabTitle(viewerElement);
    this._sendTabOpenedEvent();
    return tabInfo.id;
  }
  
  private _updateTabTitle(el: HTMLElement): void {
    const prevEl = el.parentElement.previousElementSibling;
    if (prevEl instanceof Tab) {
      
      let title = "";
      let htmlTitle = "";
      let icon = null;

      if (el instanceof EtTerminal) {
        title = el.getTerminalTitle();
        htmlTitle = he.escape(title);
        icon = "keyboard-o";

      } else if (el instanceof ViewerElement) {
        title = el.title;
        htmlTitle = he.escape(title);
        icon = el.getAwesomeIcon();

      } else if (el instanceof EtViewerTab) {
        title = el.title;
        if (el.tag !== null) {
          htmlTitle = he.escape(title) + " &nbsp;&nbsp;&nbsp;<i class='fa fa-tag'></i>" + el.tag;
        } else {
          htmlTitle = he.escape(title);
        }
        icon = el.getAwesomeIcon();
      }

      const tab = prevEl;
      const iconDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_ICON}`);
      iconDiv.innerHTML = icon !== null ? '<i class="fa fa-' + icon + '"></i>' : "";
      
      const middleDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_MIDDLE}`);

      middleDiv.title = title;
      middleDiv.innerHTML = htmlTitle;
    } else {
      this._log.warn("Unable to find the Tab element for ", el);
    }
  }

  openSettingsTab(): void {
    const settingsTabs = this._tabInfo.filter( (tabInfo) => tabInfo instanceof SettingsTabInfo );
    if (settingsTabs.length !== 0) {
      this.focusTab(settingsTabs[0].id);
    } else {
      const viewerElement = <SettingsTab> document.createElement(SettingsTab.TAG_NAME);
      config.injectConfigManager(viewerElement, this._configManager);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);
      
      const tabInfo = new SettingsTabInfo(viewerElement, this._themes);
      this.focusTab(this._openViewerTabInfo(tabInfo, viewerElement));
    }
  }
  
  openKeyBindingsTab(): void {
    const keyBindingsTabs = this._tabInfo.filter( (tabInfo) => tabInfo instanceof KeyBindingsTabInfo );
    if (keyBindingsTabs.length !== 0) {
      this.focusTab(keyBindingsTabs[0].id);
    } else {
      const viewerElement = <EtKeyBindingsTab> document.createElement(EtKeyBindingsTab.TAG_NAME);
      config.injectConfigManager(viewerElement, this._configManager);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);
      
      const tabInfo = new KeyBindingsTabInfo(viewerElement);
      this.focusTab(this._openViewerTabInfo(tabInfo, viewerElement));
    }
  }
  
  openAboutTab(): void {
    const aboutTabs = this._tabInfo.filter( (tabInfo) => tabInfo instanceof AboutTabInfo );
    if (aboutTabs.length !== 0) {
      this.focusTab(aboutTabs[0].id);
    } else {
      const viewerElement = <AboutTab> document.createElement(AboutTab.TAG_NAME);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);
      
      const tabInfo = new AboutTabInfo(viewerElement);
      this.focusTab(this._openViewerTabInfo(tabInfo, viewerElement));
    }
  }
  
  /**
   *
   */
  closeTab(tabId: number): void {
    const matches = this._tabInfo.filter( (p) => p.id === tabId );
    if (matches.length === 0) {
      this._log.warn("mainwebui.closeTab() Couldn't find the tab to close with id: " + tabId);
      return;
    }
    const tabInfo = matches[0];
    
    let paneTabInfos = this._tabInfo;
    
    let index = paneTabInfos.indexOf(tabInfo);
    
    // Remove the tab from the list.
    this._tabInfo = this._tabInfo.filter( (p) => p.id !== tabId );
    paneTabInfos = paneTabInfos.filter( tabInfo2 => tabInfo2.id !== tabId );

    tabInfo.contentDiv.parentNode.removeChild(tabInfo.contentDiv);
    tabInfo.tab.parentNode.removeChild(tabInfo.tab);
    tabInfo.destroy();

    const tabContainer = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    tabContainer.update();
    
    this._sendTabClosedEvent();
    
    paneTabInfos = this._tabInfo;
    
    if (index >= paneTabInfos.length) {
      index--;
    }
    if (paneTabInfos.length !== 0) {
      this.focusTab(paneTabInfos[index].id);
    } else {
      this.focusPane();
    }
  }

  focusTab(terminalId: number): void {
    let leftIndex = 0;
    for (let i=0; i<this._tabInfo.length; i++) {
      const tabInfo = this._tabInfo[i];
      if (tabInfo.id === terminalId) {
        const tabWidget = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
        tabWidget.setCurrentIndex(leftIndex);
        tabInfo.focus();
        return;
      }
      
      leftIndex++;
    }
  }

  focusPane(): void {
    const tabContainer = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    if (tabContainer.getCurrentIndex() < 0) {
      return;
    }
    
    // Figure out the terminal object associated with the currently shown tab inside the tab container.
    const tabsInfos = this._tabInfo;
    if (tabsInfos.length !== 0) {
      tabsInfos[tabContainer.getCurrentIndex()].focus(); // Give it the focus.
    }
  }

  /**
   * Copys the selection in the focussed terminal to the clipboard.
   */
  copyToClipboard(): void {
    const elWithFocus = this._getTabElementWithFocus();
    if (elWithFocus != null) {
      if (elWithFocus instanceof EtTerminal || elWithFocus instanceof EtViewerTab) {
        elWithFocus.copyToClipboard();
      }
    }
  }
  
  /**
   * Pastes text into the terminal which has the input focus.
   *
   * @param text the text to paste.
   */
  pasteText(text: string): void {
    const elWithFocus = this._getTabElementWithFocus();
    if (elWithFocus != null) {
      if (elWithFocus instanceof EtTerminal) {
        elWithFocus.pasteText(text);
      }
    }
  }

  private _getTabElementWithFocus(): HTMLElement {
    const tabWidget = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    for (const el of DomUtils.toArray(tabWidget.children)) {
      if (el instanceof EtViewerTab || el instanceof EtTerminal) {
        if (el.hasFocus()) {
          return el;
        }
      }
    }
    return null;
  }

  //-----------------------------------------------------------------------
  private _refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    const tabsWidgets = [<TabWidget> this._getById(ID_TAB_CONTAINER_LEFT)];

    // Collect the bulk operations from the tabs.
    const operation = BulkDomOperation.parallel(tabsWidgets.map( (tab) => tab.bulkRefresh(level) ));
    // Do the heavy code mirror stuff first.
    CodeMirrorOperation.executeBulkDOMOperation(operation);
  }

  private _sendTabOpenedEvent(): void {
    const event = new CustomEvent(MainWebUi.EVENT_TAB_OPENED, { detail: null });
    this.dispatchEvent(event);
  }
  
  private _sendTabClosedEvent(): void {
    const event = new CustomEvent(MainWebUi.EVENT_TAB_CLOSED, { detail: null });
    this.dispatchEvent(event);    
  }

  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(MainWebUi.EVENT_TITLE, { detail: {title: title} });
    this.dispatchEvent(event);
  }
  
  private _sendWindowRequestEvent(eventName: string): void {
    const event = new CustomEvent(eventName, {  });
    this.dispatchEvent(event);
  }

  private _frameFinder(frameId: string): string {
    for (let i=0; i<this._tabInfo.length; i++) {
      const text = this._tabInfo[i].getFrameContents(frameId);
      if (text !== null) {
        return text;
      }
    }
    return null;
  }
  
  // ----------------------------------------------------------------------
  //
  //   #    #                                                 
  //   #   #  ###### #   # #####   ####    ##   #####  #####  
  //   #  #   #       # #  #    # #    #  #  #  #    # #    # 
  //   ###    #####    #   #####  #    # #    # #    # #    # 
  //   #  #   #        #   #    # #    # ###### #####  #    # 
  //   #   #  #        #   #    # #    # #    # #   #  #    # 
  //   #    # ######   #   #####   ####  #    # #    # #####  
  //                                                        
  // ----------------------------------------------------------------------

  private _handleKeyDownCapture(tabInfo: TabInfo, ev: KeyboardEvent): void {
    if (this._keyBindingManager === null || this._keyBindingManager.getKeyBindingContexts() === null) {
      return;
    }
    
    const bindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_MAIN_UI);
    if (bindings === null) {
      return;
    }
    
    const command = bindings.mapEventToCommand(ev);
    if (this._executeCommand(tabInfo, command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleCommandPaletteRequest(tabInfo: TabInfo, ev: CustomEvent): void {
    if (ev.path[0] === this) { // Don't process our own messages.
      return;
    }

    ev.stopPropagation();
    
    const request: CommandPaletteRequest = ev.detail;
    const commandPaletteRequestDetail: CommandPaletteRequest = {
        srcElement: request.srcElement === null ? this : request.srcElement,
        commandEntries: [...request.commandEntries, ...this._commandPaletteEntries(tabInfo)],
        contextElement: request.contextElement
      };
    const commandPaletteRequestEvent = new CustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST,
      { detail: commandPaletteRequestDetail });
    commandPaletteRequestEvent.initCustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, true, true,
      commandPaletteRequestDetail);
    this.dispatchEvent(commandPaletteRequestEvent);
  }
  
  private _commandPaletteEntries(tabInfo: TabInfo): CommandPaletteRequestTypes.CommandEntry[] {
    
    // Create a command target object which includes the tabInfo var.
    const target: CommandPaletteRequestTypes.Commandable = {
      executeCommand: this._executeCommand.bind(this, tabInfo)
    }
    
    const commandList: CommandPaletteRequestTypes.CommandEntry[] = [
      { id: COMMAND_NEW_TAB, group: PALETTE_GROUP, iconRight: "plus", label: "New Tab", target: target },
      { id: COMMAND_CLOSE_TAB, group: PALETTE_GROUP, iconRight: "times", label: "Close Tab", target: target },
      { id: COMMAND_SELECT_TAB_LEFT, group: PALETTE_GROUP, label: "Select Previous Tab", target: target },
      { id: COMMAND_SELECT_TAB_RIGHT, group: PALETTE_GROUP, label: "Select Next Tab", target: target },
    ];

    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_MAIN_UI);
    if (keyBindings !== null) {
      commandList.forEach( (commandEntry) => {
        const shortcut = keyBindings.mapCommandToKeyBinding(commandEntry.id)
        commandEntry.shortcut = shortcut === null ? "" : shortcut;
      });
    }    
    return commandList;
  }
  
  private _executeCommand(tabInfo: TabInfo, command: string): boolean {
    switch (command) {
      case COMMAND_SELECT_TAB_LEFT:
        this._shiftTab(-1);
        break;
        
      case COMMAND_SELECT_TAB_RIGHT:
        this._shiftTab(1);
        break;
        
      case COMMAND_NEW_TAB:
        this.focusTab(this.newTerminalTab());
        break;
        
      case COMMAND_CLOSE_TAB:
        this.closeTab(tabInfo.id);
        break;
        
      default:
        return false;
    }
    return true;
  }

  //-----------------------------------------------------------------------
  // PTY and IPC handling
  //-----------------------------------------------------------------------
  private _setupIpc(): void {
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_OUTPUT, this._handlePtyOutput.bind(this));
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_CLOSE, this._handlePtyClose.bind(this));
  }
  
  private _handlePtyOutput(msg: Messages.PtyOutput): void {
    this._tabInfo.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo && (<TerminalTabInfo>tabInfo).ptyId === msg.id) {
        const status = tabInfo.terminal.write(msg.data);
        WebIpc.ptyOutputBufferSize(msg.id, status.bufferSize);
      }
    });
  }
  
  private _handlePtyClose(msg: Messages.PtyClose): void {
    this._tabInfo.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo && (<TerminalTabInfo>tabInfo).ptyId === msg.id) {
        (<TerminalTabInfo>tabInfo).ptyId = null;
        this.closeTab(tabInfo.id);
      }
    });
  }
  
  //-----------------------------------------------------------------------
  
  private _shiftTab(direction: number): void {
    const shortTabList = this._tabInfo;
    const len = shortTabList.length;
    if (len === 0) {
      return;
    }
    
    const tabWidget = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    let i = tabWidget.getCurrentIndex();
    i = i + direction;
    if (i < 0) {
      i = len - 1;
    } else if (i >= len) {
      i = 0;
    }
    tabWidget.setCurrentIndex(i);
    shortTabList[i].focus();
  }
  
  private _getById(id: string): HTMLElement {
    return <HTMLElement>DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
}
