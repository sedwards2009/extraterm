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
import {Splitter} from './gui/Splitter';
import {EmptyPaneMenu} from './EmptyPaneMenu';
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
import {SplitLayout} from './SplitLayout';

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
import log from './LogDecorator';

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

const ID_TAB_CONTAINER_LEFT = "ID_TAB_CONTAINER_LEFT";
const ID_REST_SLOT = "ID_REST_SLOT";
const ID_REST_DIV_LEFT = "ID_REST_DIV_LEFT";

const CLASS_SPLIT = "split";

const CLASS_TAB_HEADER_CONTAINER = "tab_header_container";
const CLASS_TAB_HEADER_ICON = "tab_header_icon";
const CLASS_TAB_HEADER_MIDDLE = "tab_header_middle";
const CLASS_TAB_HEADER_CLOSE = "tab_header_close";
const CLASS_TAB_CONTENT = "tab_content";
const CLASS_NEW_BUTTON_CONTAINER = "CLASS_NEW_BUTTON_CONTAINER";
const CLASS_NEW_TAB_BUTTON = "CLASS_NEW_TAB_BUTTON";

const KEYBINDINGS_MAIN_UI = "main-ui";
const PALETTE_GROUP = "mainwebui";
const COMMAND_SELECT_TAB_LEFT = "selectTabLeft";
const COMMAND_SELECT_TAB_RIGHT = "selectTabRight";
const COMMAND_NEW_TAB = "newTab";
const COMMAND_CLOSE_TAB = "closeTab";
const COMMAND_VERTICAL_SPLIT = "COMMAND_VERTICAL_SPLIT";

let registered = false;

const LAST_FOCUS = "last_focus";

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
    Splitter.init();
    EmptyPaneMenu.init();

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
  
  private _terminalPtyIdMap: Map<EtTerminal,number>;

  private _ptyIdTerminalMap: Map<number, EtTerminal>;

  private _tabIdCounter: number;
  
  private _configManager: ConfigManager;
  
  private _keyBindingManager: KeyBindingManager;

  private _themes: ThemeTypes.ThemeInfo[];

  private _internalExtratermApi: InternalExtratermApi.InternalExtratermApi;

  private _lastFocus: Element;

  private _splitLayout: SplitLayout;

  private _initProperties(): void {
    this._log = new Logger("ExtratermMainWebUI", this);
    this._terminalPtyIdMap = new Map<EtTerminal, number>();
    this._ptyIdTerminalMap = new Map<number, EtTerminal>();
    this._lastFocus = null;
    this._tabIdCounter = 0;
    this._configManager = null;
    this._keyBindingManager = null;
    this._themes = [];
    this._internalExtratermApi = null;
    this._splitLayout = new SplitLayout();
  }
  
  focus(): void {
    if (this._lastFocus != null) {
      this._focusTabContent(this._lastFocus);
    } else {

      const allContentElements = this._splitLayout.getAllTabContents();
      if (allContentElements.length !== 0) {
        this._focusTabContent(allContentElements[0]);
      }
    }
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
    return this._splitLayout.getAllTabContents().filter( (el) => !(el instanceof EmptyPaneMenu)).length;
  }
  
  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._refresh(level);
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
    
    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);

    // Update the window title when the selected tab changes and resize the terminal.
    mainContainer.addEventListener(TabWidget.EVENT_TAB_SWITCH, (ev) => {
      if (ev.target instanceof TabWidget) {
        this._handleTabSwitch(ev.target);
      }
    });

    this._splitLayout.setRootContainer(mainContainer);
    this._splitLayout.setTabContainerFactory( (tabWidget: TabWidget, tab: Tab, tabContent: Element): Element => {
      const divContainer = document.createElement("DIV");
      divContainer.classList.add(CLASS_TAB_CONTENT);
      divContainer.addEventListener('keydown', this._handleKeyDownCapture.bind(this, tabContent), true);
      divContainer.addEventListener(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, (ev: CustomEvent) => {
        this._handleCommandPaletteRequest(tabContent, ev);
      });
      return divContainer;
    });

    this._splitLayout.setRightSpaceDefaultElementFactory( (): Element => {
      const tempDiv = document.createElement("DIV");
      tempDiv.innerHTML = this._newTabRestAreaHtml();
      return tempDiv.children.item(0);
    });
    this._splitLayout.setTopLeftElement(this._leftControls());
    this._splitLayout.setTopRightElement(this._menuControls());

    mainContainer.addEventListener('click', (ev) => {
      for (const part of ev.path) {
        if (part instanceof HTMLButtonElement) {
          if (part.classList.contains(CLASS_NEW_TAB_BUTTON)) {
            let el: HTMLElement = part;
            while (el != null && ! (el instanceof TabWidget)) {
              el = el.parentElement;
            }
            const  newTerminal = this.newTerminalTab(<TabWidget> el);
            this._switchToTab(newTerminal);
          }
        } 
      }
    });

    DomUtils.getShadowId(this, ID_MINIMIZE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MINIMIZE_WINDOW_REQUEST);
    });

    DomUtils.getShadowId(this, ID_MAXIMIZE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MAXIMIZE_WINDOW_REQUEST);
    });

    DomUtils.getShadowId(this, ID_CLOSE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_CLOSE_WINDOW_REQUEST);
    });

    this._setupIpc();
  }

  private _menuControls(): Element {
    const tempDiv = document.createElement("DIV");
    tempDiv.innerHTML = this._newTabRestAreaHtml(`<slot id="${ID_REST_SLOT}"></slot>`);
    return tempDiv.children.item(0);
  }

  private _leftControls(): Element {
    const tempDiv = document.createElement("DIV");
    tempDiv.innerHTML = 
      `<div id="${ID_REST_DIV_LEFT}">` +
        `<button id="${ID_OSX_CLOSE_BUTTON}" tabindex="-1"></button>` +
        `<button id="${ID_OSX_MINIMIZE_BUTTON}" tabindex="-1"></button>` +
        `<button id="${ID_OSX_MAXIMIZE_BUTTON}" tabindex="-1"></button>` +
      `</div>`;
    
    tempDiv.querySelector("#" + ID_OSX_MINIMIZE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MINIMIZE_WINDOW_REQUEST);
    });

    tempDiv.querySelector("#" + ID_OSX_MAXIMIZE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_MAXIMIZE_WINDOW_REQUEST);
    });

    tempDiv.querySelector("#" + ID_OSX_CLOSE_BUTTON).addEventListener('click', () => {
      this.focus();
      this._sendWindowRequestEvent(MainWebUi.EVENT_CLOSE_WINDOW_REQUEST);
    });

    return tempDiv.children.item(0);
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
      `</div>` +
    `</div>`;
  }

  private _newTabRestAreaHtml(extraContents = ""): string {
    return `<div class="${CLASS_NEW_BUTTON_CONTAINER}"><button class="btn btn-quiet ${CLASS_NEW_TAB_BUTTON}"><i class="fa fa-plus"></i></button>${extraContents}</div>`;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.MAIN_UI];
  }

  destroy(): void {
  }
  

  // ----------------------------------------------------------------------
  //
  //   #######                      
  //      #      ##   #####   ####  
  //      #     #  #  #    # #      
  //      #    #    # #####   ####  
  //      #    ###### #    #      # 
  //      #    #    # #    # #    # 
  //      #    #    # #####   ####  
  //
  // ----------------------------------------------------------------------

  /**
   * Initialise and insert a tab.
   * 
   */
  private _addTab(tabWidget: TabWidget, tabContentElement: Element): Tab {
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

    this._splitLayout.appendTab(tabWidget, newTab, tabContentElement);
    this._splitLayout.update();

    const closeTabButton = DomUtils.getShadowRoot(this).getElementById("close_tag_id_" + newId);
    closeTabButton.addEventListener('click', (ev: MouseEvent): void => {
      this.closeTab(tabContentElement);
    });
  
    return newTab;
  }

  private _tabFromElement(el: Element): Tab {
    return this._splitLayout.getTabByTabContent(el);
  }

  private _tabWidgetFromElement(el: Element): TabWidget {
    return this._splitLayout.getTabWidgetByTabContent(el);
  }

  private _firstTabWidget(): TabWidget {
    return <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
  }

  private _handleTabSwitch(tabWidget: TabWidget): void {
    const el = this._splitLayout.getTabContentByTab(tabWidget.getCurrentTab());
    let title = "";
    if (el instanceof EtTerminal) {
      title = el.getTerminalTitle();
    } else if (el instanceof EtViewerTab) {        
      title = el.title;
    } else if (el instanceof ViewerElement) {
      title = el.title;
    }

    this._sendTitleEvent(title);
    this._focusTabContent(el);
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(tabWidget: TabWidget = null): EtTerminal {
    if (tabWidget == null) {
      tabWidget = this._splitLayout.firstTabWidget();
    }

    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    config.injectConfigManager(newTerminal, this._configManager);
    keybindingmanager.injectKeyBindingManager(newTerminal, this._keyBindingManager);
    newTerminal.setFrameFinder(this._frameFinder.bind(this));

    this._terminalPtyIdMap.set(newTerminal, null);
    const currentConfig = this._configManager.getConfig();
    newTerminal.setBlinkingCursor(currentConfig.blinkingCursor);
    newTerminal.setScrollbackSize(currentConfig.scrollbackLines);

    this._addTab(tabWidget, newTerminal);
    
    newTerminal.addEventListener('focus', (ev: FocusEvent) => {
      this._lastFocus = newTerminal;
    });
    
    // User input event
    newTerminal.addEventListener(EtTerminal.EVENT_USER_INPUT, (ev: CustomEvent): void => {
      const ptyId = this._terminalPtyIdMap.get(newTerminal);
      if (ptyId != null) {
        WebIpc.ptyInput(ptyId, (<any> ev).detail.data);
      }
    });
    
    let currentColumns = newTerminal.getColumns();
    let currentRows = newTerminal.getRows();

    // Terminal resize event
    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_RESIZE, (ev: CustomEvent): void => {
      currentColumns = (<any> ev).detail.columns;
      currentRows = (<any> ev).detail.rows;
      const ptyId = this._terminalPtyIdMap.get(newTerminal);
      if (ptyId != null) {
        WebIpc.ptyResize(ptyId, currentColumns, currentRows);
      }
    });

    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_BUFFER_SIZE, (ev: CustomEvent): void => {
      const status: { bufferSize: number;} = <any> ev.detail;
      const ptyId = this._terminalPtyIdMap.get(newTerminal);
      if(ptyId != null) {
        WebIpc.ptyOutputBufferSize(ptyId, status.bufferSize);
      }
    });

    // Terminal title event
    newTerminal.addEventListener(EtTerminal.EVENT_TITLE, (ev: CustomEvent): void => {
      this._updateTabTitle(newTerminal);
      this._sendTitleEvent(ev.detail.title);
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT, (ev: CustomEvent): void => {
      this.openViewerTab(ev.detail.embeddedViewer, ev.detail.terminal.getFontAdjust());
      this._switchToTab(ev.detail.embeddedViewer);
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
        this._terminalPtyIdMap.set(newTerminal, msg.id);
        this._ptyIdTerminalMap.set(msg.id, newTerminal);
        WebIpc.ptyResize(msg.id, currentColumns, currentRows);
        WebIpc.ptyOutputBufferSize(msg.id, 1024);  // Just big enough to get things started. We don't need the exact buffer size.
      });

    this._updateTabTitle(newTerminal);
    this._sendTabOpenedEvent();

    this._internalExtratermApi.addTab(newTerminal);
    return newTerminal;
  }
  
  openViewerTab(embeddedViewer: EmbeddedViewer, fontAdjust: number): void {
    const viewerElement = embeddedViewer.getViewerElement();
    const viewerTab = <EtViewerTab> document.createElement(EtViewerTab.TAG_NAME);
    viewerTab.setFontAdjust(fontAdjust);
    keybindingmanager.injectKeyBindingManager(viewerTab, this._keyBindingManager);
    viewerTab.setTitle(embeddedViewer.getTitle());
    viewerTab.setTag(embeddedViewer.getTag());
    
    viewerElement.setMode(ViewerElementTypes.Mode.CURSOR);
    viewerElement.setVisualState(VisualState.AUTO);
    const result = this._openViewerTab(this._firstTabWidget(), viewerTab);
    viewerTab.setViewerElement(viewerElement);

    this._updateTabTitle(viewerTab);
  }
  
  private _openViewerTab(tabWidget: TabWidget, viewerElement: ViewerElement): void {
    viewerElement.setFocusable(true);
    this._addTab(tabWidget, viewerElement);

    viewerElement.addEventListener('focus', (ev: FocusEvent) => {
      this._lastFocus = viewerElement;
    });

    this._updateTabTitle(viewerElement);
    this._sendTabOpenedEvent();
  }
  
  private _updateTabTitle(el: HTMLElement): void {
    const tab = this._splitLayout.getTabByTabContent(el);
     
    let title = "";
    let htmlTitle = "";
    let icon = null;

    if (el instanceof EtTerminal) {
      title = el.getTerminalTitle();
      htmlTitle = he.escape(title);
      icon = "keyboard-o";

    } else if (el instanceof EtViewerTab) {
      title = el.getTitle();
      if (el.getTag() !== null) {
        htmlTitle = he.escape(title) + " &nbsp;&nbsp;&nbsp;<i class='fa fa-tag'></i>" + el.getTag();
      } else {
        htmlTitle = he.escape(title);
      }
      icon = el.getAwesomeIcon();

    } else if (el instanceof ViewerElement) {
      title = el.getTitle();
      htmlTitle = he.escape(title);
      icon = el.getAwesomeIcon();

    } else {
      this._log.warn(`Unrecognized element type in _updateTabTitle(). ${el}`);
    }

    const iconDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_ICON}`);
    iconDiv.innerHTML = icon !== null ? '<i class="fa fa-' + icon + '"></i>' : "";
    
    const middleDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_MIDDLE}`);

    middleDiv.title = title;
    middleDiv.innerHTML = htmlTitle;
  }

  openSettingsTab(): void {
    const settingsTabs = this._splitLayout.getAllTabContents().filter( (el) => el instanceof SettingsTab );
    if (settingsTabs.length !== 0) {
      this._switchToTab(settingsTabs[0]);
    } else {
      const viewerElement = <SettingsTab> document.createElement(SettingsTab.TAG_NAME);
      config.injectConfigManager(viewerElement, this._configManager);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);
      
      viewerElement.setThemes(this._themes);
      this._openViewerTab(this._firstTabWidget(), viewerElement);
      this._switchToTab(viewerElement);
    }
  }
  
  openKeyBindingsTab(): void {
    const keyBindingsTabs = this._splitLayout.getAllTabContents().filter( (el) => el instanceof EtKeyBindingsTab );
    if (keyBindingsTabs.length !== 0) {
      this._switchToTab(keyBindingsTabs[0]);
    } else {
      const viewerElement = <EtKeyBindingsTab> document.createElement(EtKeyBindingsTab.TAG_NAME);
      config.injectConfigManager(viewerElement, this._configManager);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);

      this._openViewerTab(this._firstTabWidget(), viewerElement);
      this._switchToTab(viewerElement);
    }
  }
  
  openAboutTab(): void {
    const aboutTabs = this._splitLayout.getAllTabContents().filter( (el) => el instanceof AboutTab );
    if (aboutTabs.length !== 0) {
      this._switchToTab(aboutTabs[0]);
    } else {
      const viewerElement = <AboutTab> document.createElement(AboutTab.TAG_NAME);
      keybindingmanager.injectKeyBindingManager(viewerElement, this._keyBindingManager);
      this._openViewerTab(this._firstTabWidget(), viewerElement);
      this._switchToTab(viewerElement);
    }
  }
  
  /**
   *
   */
  closeTab(tabContentElement: Element): void {
    const allTabContents = this._splitLayout.getAllTabContents();

    this._splitLayout.removeTabContent(tabContentElement);
    this._splitLayout.update();

    if (tabContentElement instanceof EtTerminal) {
      const ptyId = this._terminalPtyIdMap.get(tabContentElement);
      tabContentElement.destroy();
      if (ptyId !== null) {
        WebIpc.ptyClose(ptyId);
      }
      this._terminalPtyIdMap.delete(tabContentElement);
      this._ptyIdTerminalMap.delete(ptyId);
    }
    
    const newIndex = Math.min(allTabContents.indexOf(tabContentElement)-1, allTabContents.length-1);
    if (newIndex < 0) {
      this.focusPane();
    } else {
      this._switchToTab(allTabContents[newIndex]);
    }

    this._sendTabClosedEvent();
  }

  private _switchToTab(tabContentElement: Element): void {
    this._splitLayout.showTabByTabContent(tabContentElement);
    this._focusTabContent(tabContentElement);
  }

  private _shiftTab(tabWidget: TabWidget, direction: number): void {
    const tabElementList = this._splitLayout.getAllTabContents();
    const len = tabElementList.length;
    if (len === 0) {
      return;
    }
    
    let i = tabWidget.getCurrentIndex();
    i = i + direction;
    if (i < 0) {
      i = len - 1;
    } else if (i >= len) {
      i = 0;
    }
    tabWidget.setCurrentIndex(i);
    this._focusTabContent(tabElementList[i]);
  }

  focusPane(): void {
    // FIXME
  }

  private _getTabElementWithFocus(): Element {
    for (const el of this._splitLayout.getAllTabContents()) {
      if (el instanceof EtViewerTab || el instanceof EtTerminal) {
        if (el.hasFocus()) {
          return el;
        }
      }
    }
    return null;
  }

  private _focusTabContent(el: Element): void {
    if (el instanceof EtTerminal) {
      el.resizeToContainer();
      el.focus();
    } else if (el instanceof ViewerElement) {
      el.focus();
    }
  }

  //-----------------------------------------------------------------------
  //
  //    #####
  //   #     # #####  #      # #####  ####  
  //   #       #    # #      #   #   #      
  //    #####  #    # #      #   #    ####  
  //         # #####  #      #   #        # 
  //   #     # #      #      #   #   #    # 
  //    #####  #      ###### #   #    ####  
  //
  //-----------------------------------------------------------------------

  private _verticalSplit(tabContentElement: Element): void {
    const tabWidget = this._tabWidgetFromElement(tabContentElement);
    const rootContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);

    if (tabWidget.parentElement === rootContainer) {
      // Single tab widget directly inside the container DIV.
      const splitter = <Splitter> document.createElement(Splitter.TAG_NAME);
      rootContainer.appendChild(splitter);
      splitter.appendChild(tabWidget);
      const newTabWidget = this._newTabWidget();
      newTabWidget.setShowTabs(false);
      splitter.appendChild(newTabWidget);

      const emptyPaneMenu = this._insertEmptyPaneMenu(newTabWidget);

      this._repositionParentContent();
      tabWidget.update();
      splitter.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);

      setTimeout(()=>{  // FIXME using a time out doesn't feel right, and I don't know why an immediate .focus() doesn't work.
        emptyPaneMenu.focus();
      }, 0);

    } else {



    }
  }

  private _insertEmptyPaneMenu(tabWidget: TabWidget): EmptyPaneMenu {
    // Insert an Empty Pane Menu 
    const emptyPaneMenuTab = <Tab> document.createElement(Tab.TAG_NAME);
    const emptyPaneMenuDiv = <HTMLDivElement> document.createElement("DIV");
    emptyPaneMenuDiv.classList.add(CLASS_TAB_CONTENT);

    const emptyPaneMenu = <EmptyPaneMenu> document.createElement(EmptyPaneMenu.TAG_NAME);

    emptyPaneMenu.addEventListener("selected", (ev: CustomEvent): void => {
      this._executeCommand(emptyPaneMenu, ev.detail.selected);
    });
    emptyPaneMenu.addEventListener('focus', (ev: FocusEvent) => {
      this._lastFocus = emptyPaneMenu;
    });

    emptyPaneMenu.setEntries(this._commandPaletteEntries(emptyPaneMenu));
    emptyPaneMenuDiv.appendChild(emptyPaneMenu);

    if (tabWidget.children.length !== 0) {
      tabWidget.insertBefore(emptyPaneMenuDiv, tabWidget.children.item(0));
      tabWidget.insertBefore(emptyPaneMenuTab, emptyPaneMenuDiv);
    } else {
      tabWidget.appendChild(emptyPaneMenuTab);
      tabWidget.appendChild(emptyPaneMenuDiv);
    }
    tabWidget.setShowTabs(false);
    return emptyPaneMenu;
  }

  private _repositionParentContent(): void {
    const topRightTabWidget = this._findTopRightTabWidget(DomUtils.getShadowId(this, ID_MAIN_CONTENTS));
    const restSlot = DomUtils.getShadowId(this, ID_REST_SLOT);
    const newButtonContainer = topRightTabWidget.querySelector("."  + CLASS_NEW_BUTTON_CONTAINER);
    newButtonContainer.appendChild(restSlot);
  }

  private _findTopRightTabWidget(parentEl: HTMLElement): TabWidget {
    const lastChild = parentEl.children.item(parentEl.children.length-1);
    if (lastChild instanceof Splitter) {
      // Check for vertical or horizontal split.
      // if (vertical) {
        return this._findTopRightTabWidget(lastChild);
      // } else {
      //   return this._findTopLeftTabWidget(lastChild);
      // }
    }
    if (lastChild instanceof TabWidget) {
      return lastChild;
    }
    return null;
  }

  //-----------------------------------------------------------------------
  //
  //    #####                                                     
  //   #     # #      # #####  #####   ####    ##   #####  #####  
  //   #       #      # #    # #    # #    #  #  #  #    # #    # 
  //   #       #      # #    # #####  #    # #    # #    # #    # 
  //   #       #      # #####  #    # #    # ###### #####  #    # 
  //   #     # #      # #      #    # #    # #    # #   #  #    # 
  //    #####  ###### # #      #####   ####  #    # #    # #####  
  //
  //-----------------------------------------------------------------------

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

  //-----------------------------------------------------------------------
  private _refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    const operation = ResizeRefreshElementBase.ResizeRefreshElementBase.bulkRefreshChildNodes(
      DomUtils.getShadowId(this, ID_MAIN_CONTENTS), level);

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
    for (const el of this._splitLayout.getAllTabContents()) {
      let text = null;
      if (el instanceof EtViewerTab && el.getTag() === frameId) {
        text = el.getFrameContents(frameId);
      } else if (el instanceof EtTerminal) {
        text = el.getFrameContents(frameId);
      }
      if (text != null) {
        return text;
      }
    }
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

  private _handleKeyDownCapture(tabContentElement: Element, ev: KeyboardEvent): void {
    if (this._keyBindingManager === null || this._keyBindingManager.getKeyBindingContexts() === null) {
      return;
    }
    
    const bindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_MAIN_UI);
    if (bindings === null) {
      return;
    }
    
    const command = bindings.mapEventToCommand(ev);
    if (this._executeCommand(tabContentElement, command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  //-----------------------------------------------------------------------
  //
  //    #####                                               ######                                          
  //   #     #  ####  #    # #    #   ##   #    # #####     #     #   ##   #      ###### ##### ##### ###### 
  //   #       #    # ##  ## ##  ##  #  #  ##   # #    #    #     #  #  #  #      #        #     #   #      
  //   #       #    # # ## # # ## # #    # # #  # #    #    ######  #    # #      #####    #     #   #####  
  //   #       #    # #    # #    # ###### #  # # #    #    #       ###### #      #        #     #   #      
  //   #     # #    # #    # #    # #    # #   ## #    #    #       #    # #      #        #     #   #      
  //    #####   ####  #    # #    # #    # #    # #####     #       #    # ###### ######   #     #   ###### 
  //
  //-----------------------------------------------------------------------

  private _handleCommandPaletteRequest(tabContentElement: Element, ev: CustomEvent): void {
    if (ev.path[0] === this) { // Don't process our own messages.
      return;
    }

    ev.stopPropagation();
    
    const request: CommandPaletteRequest = ev.detail;
    const commandPaletteRequestDetail: CommandPaletteRequest = {
        srcElement: request.srcElement === null ? this : request.srcElement,
        commandEntries: [...request.commandEntries, ...this._commandPaletteEntries(tabContentElement)],
        contextElement: request.contextElement
      };
    const commandPaletteRequestEvent = new CustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST,
      { detail: commandPaletteRequestDetail });
    commandPaletteRequestEvent.initCustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, true, true,
      commandPaletteRequestDetail);
    this.dispatchEvent(commandPaletteRequestEvent);
  }
  
  private _commandPaletteEntries(tabContentElement: Element): CommandPaletteRequestTypes.CommandEntry[] {
    
    // Create a command target object which includes the tabContentElement var.
    const target: CommandPaletteRequestTypes.Commandable = {
      executeCommand: this._executeCommand.bind(this, tabContentElement)
    }
    
    const commandList: CommandPaletteRequestTypes.CommandEntry[] = [
      { id: COMMAND_NEW_TAB, group: PALETTE_GROUP, iconRight: "plus", label: "New Tab", target: target },
      { id: COMMAND_CLOSE_TAB, group: PALETTE_GROUP, iconRight: "times", label: "Close Tab", target: target },
      { id: COMMAND_SELECT_TAB_LEFT, group: PALETTE_GROUP, label: "Select Previous Tab", target: target },
      { id: COMMAND_SELECT_TAB_RIGHT, group: PALETTE_GROUP, label: "Select Next Tab", target: target },
      { id: COMMAND_VERTICAL_SPLIT, group: PALETTE_GROUP, iconRight: "columns", label: "Vertical Split", target: target }
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
  
  private _executeCommand(tabElement: Element, command: string): boolean {
    switch (command) {
      case COMMAND_SELECT_TAB_LEFT:
        this._shiftTab(this._tabWidgetFromElement(tabElement), -1);
        break;
        
      case COMMAND_SELECT_TAB_RIGHT:
        this._shiftTab(this._tabWidgetFromElement(tabElement), 1);
        break;
        
      case COMMAND_NEW_TAB:
        this._switchToTab(this.newTerminalTab(this._tabWidgetFromElement(tabElement)));
        break;
        
      case COMMAND_CLOSE_TAB:
        this.closeTab(tabElement);
        break;

      case COMMAND_VERTICAL_SPLIT:
        this._verticalSplit(tabElement);
        break;

      default:
        return false;
    }
    return true;
  }

  //-----------------------------------------------------------------------
  //
  //   ######  ####### #     # 
  //   #     #    #     #   #  
  //   #     #    #      # #   
  //   ######     #       #    
  //   #          #       #    
  //   #          #       #    
  //   #          #       #    
  //
  //-----------------------------------------------------------------------
  private _setupIpc(): void {
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_OUTPUT, this._handlePtyOutput.bind(this));
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_CLOSE, this._handlePtyClose.bind(this));
  }
  
  private _handlePtyOutput(msg: Messages.PtyOutput): void {
    const terminal = this._ptyIdTerminalMap.get(msg.id);
    if (terminal == null) {
      this._log.warn(`Unable to find a Terminal object to match pty ID ${msg.id}`);
      return;
    }

    const status = terminal.write(msg.data);
    WebIpc.ptyOutputBufferSize(msg.id, status.bufferSize);
  }
  
  private _handlePtyClose(msg: Messages.PtyClose): void {
    const terminal = this._ptyIdTerminalMap.get(msg.id);
    if (terminal == null) {
      this._log.warn(`Unable to find a Terminal object to match pty ID ${msg.id}`);
      return;
    }

    this.closeTab(terminal);
  }
  
  //-----------------------------------------------------------------------
  
  
  private _getById(id: string): HTMLElement {
    return <HTMLElement>DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
}
