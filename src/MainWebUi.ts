/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from './DomUtils';
import * as util from './gui/Util';
import {ThemeableElementBase} from './ThemeableElementBase';
import {TabWidget, DroppedEventDetail} from './gui/TabWidget';
import {EtTerminal} from './Terminal';
import {SettingsTab} from './settings/SettingsTab';
import {AboutTab} from './AboutTab';
import {EtKeyBindingsTab} from './KeyBindingsTab';
import {EtViewerTab} from './ViewerTab';
import {EmbeddedViewer} from './EmbeddedViewer';
import {Tab} from './gui/Tab';
import {ViewerElement} from './ViewerElement';
import {Splitter, SplitOrientation} from './gui/Splitter';
import {SnapDropContainer, DroppedEventDetail as SnapDroppedEventDetail, DropLocation} from './gui/SnapDropContainer';
import {EmptyPaneMenu} from './EmptyPaneMenu';
import * as ViewerElementTypes from './ViewerElementTypes';
import * as ThemeTypes from './Theme';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';
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

import {EVENT_DRAG_STARTED, EVENT_DRAG_ENDED} from './GeneralEvents';
import {ElementMimeType, FrameMimeType} from './InternalMimeTypes';

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

const ID_REST_SLOT = "ID_REST_SLOT";
const ID_REST_DIV_LEFT = "ID_REST_DIV_LEFT";

const CLASS_SPLIT = "split";

const CLASS_TAB_HEADER_CONTAINER = "tab_header_container";
const CLASS_TAB_HEADER_ICON = "tab_header_icon";
const CLASS_TAB_HEADER_MIDDLE = "tab_header_middle";
const CLASS_TAB_HEADER_TAG = "tab_header_tag";
const CLASS_TAB_HEADER_CLOSE = "tab_header_close";
const CLASS_TAB_CONTENT = "tab_content";
const CLASS_NEW_BUTTON_CONTAINER = "CLASS_NEW_BUTTON_CONTAINER";
const CLASS_NEW_TAB_BUTTON = "CLASS_NEW_TAB_BUTTON";
const CLASS_SPACE = "CLASS_SPACE";
const CLASS_MAIN_DRAGGING = "CLASS_MAIN_DRAGGING";
const CLASS_MAIN_NOT_DRAGGING = "CLASS_MAIN_NOT_DRAGGING";

const KEYBINDINGS_MAIN_UI = "main-ui";
const PALETTE_GROUP = "mainwebui";
const COMMAND_SELECT_TAB_LEFT = "selectTabLeft";
const COMMAND_SELECT_TAB_RIGHT = "selectTabRight";
const COMMAND_SELECT_PANE_LEFT = "selectPaneLeft";
const COMMAND_SELECT_PANE_RIGHT = "selectPaneRight";
const COMMAND_SELECT_PANE_ABOVE = "selectPaneAbove";
const COMMAND_SELECT_PANE_BELOW = "selectPaneBelow";
const COMMAND_MOVE_TAB_LEFT = "moveTabLeft";
const COMMAND_MOVE_TAB_RIGHT = "moveTabRight";
const COMMAND_MOVE_TAB_UP = "moveTabUp";
const COMMAND_MOVE_TAB_DOWN = "moveTabDown";
const COMMAND_NEW_TERMINAL = "newTerminal";
const COMMAND_CLOSE_TAB = "closeTab";
const COMMAND_HORIZONTAL_SPLIT = "horizontalSplit";
const COMMAND_VERTICAL_SPLIT = "verticalSplit";
const COMMAND_CLOSE_PANE = "closePane";

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
      window.customElements.define(MainWebUi.TAG_NAME.toLowerCase(), MainWebUi);
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
  
  constructor() {
    super();
    this._initProperties(); // Initialise our properties. The constructor was not called.
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    this._setUpShadowDom();   
    this._setUpMainContainer();
    this._setUpSplitLayout();
    this._setUpWindowControls();
    this._setupIpc();
  }

  private _setUpShadowDom(): void {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
  }

  private _setUpMainContainer(): void {
    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);
    mainContainer.classList.add(CLASS_MAIN_NOT_DRAGGING);

    mainContainer.addEventListener(TabWidget.EVENT_TAB_SWITCH, this._handleTabSwitchEvent.bind(this));
    mainContainer.addEventListener(TabWidget.EVENT_DROPPED, this._handleTabWidgetDroppedEvent.bind(this));
    mainContainer.addEventListener(SnapDropContainer.EVENT_DROPPED, this._handleTabWidgetSnapDroppedEvent.bind(this));
    DomUtils.addCustomEventResender(mainContainer, EVENT_DRAG_STARTED, this);
    DomUtils.addCustomEventResender(mainContainer, EVENT_DRAG_ENDED, this);
    mainContainer.addEventListener(EVENT_DRAG_STARTED, this._handleDragStartedEvent.bind(this));
    mainContainer.addEventListener(EVENT_DRAG_ENDED, this._handleDragEndedEvent.bind(this));
    mainContainer.addEventListener('click', this._handleMainContainerClickEvent.bind(this));
  }

  private _handleTabWidgetDroppedEvent(ev: CustomEvent): void {
    const detail = <DroppedEventDetail> ev.detail;

    if (detail.mimeType === ElementMimeType.MIMETYPE) {
      this._handleElementDroppedEvent(detail.targetTabWidget, detail.tabIndex, detail.dropData);
    } else if (detail.mimeType === FrameMimeType.MIMETYPE) {
      this._handleFrameDroppedEvent(detail.targetTabWidget, detail.tabIndex, detail.dropData);
    }
  }

  private _handleElementDroppedEvent(targetTabWidget: TabWidget, tabIndex: number, dropData: string): void {
    if (ElementMimeType.tagNameFromData(dropData) === Tab.TAG_NAME) {
      const tabElement = <Tab> DomUtils.getShadowId(this, ElementMimeType.elementIdFromData(dropData));
      
      this._splitLayout.moveTabToTabWidget(tabElement, targetTabWidget, tabIndex);
      this._splitLayout.update();

      const tabContent = this._splitLayout.getTabContentByTab(tabElement);
      targetTabWidget.setSelectedIndex(tabIndex);
      this._focusTabContent(tabContent);
    }
  }

  private _handleFrameDroppedEvent(targetTabWidget: TabWidget, tabIndex: number, dropData: string): void {
    for (const el of this._splitLayout.getAllTabContents()) {
      if (el instanceof EtTerminal) {
        const embeddedViewer = el.getEmbeddedViewerByFrameId(dropData);
        if (embeddedViewer != null) {
          const viewerTab = this._popOutEmbeddedViewer(embeddedViewer, el);
          const tab = this._splitLayout.getTabByTabContent(viewerTab);
          this._splitLayout.moveTabToTabWidget(tab, targetTabWidget, tabIndex);
          this._splitLayout.update();
          this._switchToTab(viewerTab);
          return;
        }
      }
    }
  }

  private _handleTabWidgetSnapDroppedEvent(ev: CustomEvent): void {
    const detail = <SnapDroppedEventDetail> ev.detail;
    const target = ev.target;
    if (target instanceof TabWidget) {
      switch (detail.dropLocation) {
        case DropLocation.MIDDLE:
          this._handleTabWidgetSnapDroppedMiddleEvent(ev);
          break;

        case DropLocation.NORTH:
          this._handleTabWidgetSnapDroppedDirectionEvent(ev, SplitOrientation.HORIZONTAL, true);
          break;

        case DropLocation.SOUTH:
          this._handleTabWidgetSnapDroppedDirectionEvent(ev, SplitOrientation.HORIZONTAL, false);
          break;

        case DropLocation.WEST:
          this._handleTabWidgetSnapDroppedDirectionEvent(ev, SplitOrientation.VERTICAL, true);
          break;

        case DropLocation.EAST:
          this._handleTabWidgetSnapDroppedDirectionEvent(ev, SplitOrientation.VERTICAL, false);
          break;
      }
    }
  }

  private _handleTabWidgetSnapDroppedMiddleEvent(ev: CustomEvent): void {
    const detail = <SnapDroppedEventDetail> ev.detail;
    const target = ev.target;
    if (target instanceof TabWidget) {
      if (detail.mimeType === ElementMimeType.MIMETYPE) {
        this._handleElementDroppedEvent(target, target.getSelectedIndex(), detail.dropData);
      } else if (detail.mimeType === FrameMimeType.MIMETYPE) {
        this._handleElementDroppedEvent(target, target.getSelectedIndex(), detail.dropData);
      }
    }
  }

  private _handleTabWidgetSnapDroppedDirectionEvent(ev: CustomEvent, orientation: SplitOrientation,
                                                    splitBefore: boolean): void {
    const detail = <SnapDroppedEventDetail> ev.detail;
    const target = ev.target;
    if (target instanceof TabWidget) {

      const newTabWidget = splitBefore ? this._splitLayout.splitBeforeTabWidget(target, orientation) : this._splitLayout.splitAfterTabWidget(target, orientation);
      this._splitLayout.update();

      if (detail.mimeType === ElementMimeType.MIMETYPE) {
        this._handleElementDroppedEvent(newTabWidget, 0, detail.dropData);
      } else if (detail.mimeType === FrameMimeType.MIMETYPE) {
        this._handleFrameDroppedEvent(newTabWidget, 0, detail.dropData);
      }
      this._refreshSplitLayout();
    }    
  }

  private _handleDragStartedEvent(ev: CustomEvent): void {
    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);
    mainContainer.classList.add(CLASS_MAIN_DRAGGING);
    mainContainer.classList.remove(CLASS_MAIN_NOT_DRAGGING);
  }

  private _handleDragEndedEvent(ev: CustomEvent): void {
    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);
    mainContainer.classList.remove(CLASS_MAIN_DRAGGING);
    mainContainer.classList.add(CLASS_MAIN_NOT_DRAGGING);
  }

  private _handleMainContainerClickEvent(ev): void {
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
  }

  private _setUpSplitLayout(): void {
    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);

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

    this._splitLayout.setEmptySplitElementFactory( () => {
      const emptyPaneMenu = <EmptyPaneMenu> document.createElement(EmptyPaneMenu.TAG_NAME);
      const commandList: CommandPaletteRequestTypes.CommandEntry[] = [
        { id: COMMAND_NEW_TERMINAL, group: PALETTE_GROUP, iconRight: "plus", label: "New Terminal", target: null },
        { id: COMMAND_HORIZONTAL_SPLIT, group: PALETTE_GROUP, iconRight: "extraicon-#xea08", label: "Horizontal Split", target: null },        
        { id: COMMAND_VERTICAL_SPLIT, group: PALETTE_GROUP, iconRight: "columns", label: "Vertical Split", target: null },
        { id: COMMAND_CLOSE_PANE, group: PALETTE_GROUP, label: "Close Pane", target: null }
      ];
      this._insertCommandKeyBindings(commandList);

      emptyPaneMenu.setEntries(commandList);
      emptyPaneMenu.addEventListener("selected", (ev: CustomEvent): void => {
        emptyPaneMenu.setFilter("");
        this._executeCommand(emptyPaneMenu, ev.detail.selected);
      });
      return emptyPaneMenu;
    });
  }

  private _setUpWindowControls(): void {
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
    return `<div class="${CLASS_NEW_BUTTON_CONTAINER}"><button class="btn btn-quiet ${CLASS_NEW_TAB_BUTTON}"><i class="fa fa-plus"></i></button>
    <div class="${CLASS_SPACE}"></div>${extraContents}</div>`;
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
    newTab.setAttribute('id', "tab_id_" + newId);
    newTab.tabIndex = -1;
    newTab.innerHTML = 
      `<div class="${CLASS_TAB_HEADER_CONTAINER}">` +
        `<div class="${CLASS_TAB_HEADER_ICON}"></div>` +
        `<div class="${CLASS_TAB_HEADER_MIDDLE}">${newId}</div>` +
        `<div class="${CLASS_TAB_HEADER_TAG}"></div>` +
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
    return this._splitLayout.firstTabWidget();
  }

  private _handleTabSwitchEvent(ev: CustomEvent): void {
    if (ev.target instanceof TabWidget) {
      const el = this._splitLayout.getTabContentByTab(ev.target.getSelectedTab());
      let title = "";
      if (el instanceof EtTerminal) {
        title = el.getTerminalTitle();
      } else if (el instanceof EtViewerTab) {        
        title = el.getTitle();
      } else if (el instanceof ViewerElement) {
        title = el.getTitle();
      }

      this._sendTitleEvent(title);
      this._focusTabContent(el);
    }
  }
  
  newTerminalTab(tabWidget: TabWidget = null): EtTerminal {
    if (tabWidget == null) {
      tabWidget = this._splitLayout.firstTabWidget();
    }

    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    config.injectConfigManager(newTerminal, this._configManager);
    keybindingmanager.injectKeyBindingManager(newTerminal, this._keyBindingManager);
    newTerminal.setFrameFinder(this._frameFinder.bind(this));

    this._terminalPtyIdMap.set(newTerminal, null);

    this._applyNewTerminalConfig(newTerminal, this._configManager.getConfig());
    this._addTab(tabWidget, newTerminal);
    this._setUpNewTerminalEventHandlers(newTerminal);
    this._createPtyForTerminal(newTerminal);
    this._updateTabTitle(newTerminal);
    this._sendTabOpenedEvent();

    this._internalExtratermApi.addTab(newTerminal);
    newTerminal.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
    return newTerminal;
  }

  private _applyNewTerminalConfig(newTerminal: EtTerminal, config: config.Config): void {
    newTerminal.setBlinkingCursor(config.blinkingCursor);
    newTerminal.setScrollbackSize(config.scrollbackLines);
  }

  private _createPtyForTerminal(newTerminal: EtTerminal): void {
    const sessionProfile = this._configManager.getConfig().expandedProfiles[0];
    const newEnv = _.cloneDeep(process.env);
    const expandedExtra = sessionProfile.extraEnv;

    let prop: string;
    for (prop in expandedExtra) {
      newEnv[prop] = expandedExtra[prop];
    }

    WebIpc.requestPtyCreate(sessionProfile.command, sessionProfile.arguments,
        newTerminal.getColumns(), newTerminal.getRows(), newEnv)
      .then( (msg: Messages.CreatedPtyMessage) => {
        this._terminalPtyIdMap.set(newTerminal, msg.id);
        this._ptyIdTerminalMap.set(msg.id, newTerminal);
        WebIpc.ptyResize(msg.id, newTerminal.getColumns(), newTerminal.getRows());
        WebIpc.ptyOutputBufferSize(msg.id, 1024);  // Just big enough to get things started. We don't need the exact buffer size.
      });
  }

  private _setUpNewTerminalEventHandlers(newTerminal: EtTerminal): void {
    newTerminal.addEventListener('focus', (ev: FocusEvent) => {
      this._lastFocus = newTerminal;
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_USER_INPUT, (ev: CustomEvent): void => {
      const ptyId = this._terminalPtyIdMap.get(newTerminal);
      if (ptyId != null) {
        WebIpc.ptyInput(ptyId, (<any> ev).detail.data);
      }
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_RESIZE, (ev: CustomEvent): void => {
      const currentColumns = (<any> ev).detail.columns;
      const currentRows = (<any> ev).detail.rows;
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

    newTerminal.addEventListener(EtTerminal.EVENT_TITLE, (ev: CustomEvent): void => {
      this._updateTabTitle(newTerminal);
      this._sendTitleEvent(ev.detail.title);
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT,
      this._handleEmbeddedViewerPopOutEvent.bind(this));
  }
  
  private _handleEmbeddedViewerPopOutEvent(ev: CustomEvent): void {
    this._popOutEmbeddedViewer(ev.detail.embeddedViewer, ev.detail.terminal);
  }

  private _popOutEmbeddedViewer(embeddedViewer: EmbeddedViewer, terminal: EtTerminal): EtViewerTab {
    const viewerTab = this.openViewerTab(embeddedViewer, terminal.getFontAdjust());
    this._switchToTab(viewerTab);
    terminal.deleteEmbeddedViewer(embeddedViewer);
    return viewerTab;
  }

  openViewerTab(embeddedViewer: EmbeddedViewer, fontAdjust: number): EtViewerTab {
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
    this._internalExtratermApi.addTab(viewerTab);
    return viewerTab;
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
    let tag = "";

    if (el instanceof EtTerminal) {
      title = el.getTerminalTitle();
      htmlTitle = he.escape(title);
      icon = "keyboard-o";

    } else if (el instanceof EtViewerTab) {
      title = el.getTitle();
      htmlTitle = he.escape(title);
      icon = el.getAwesomeIcon();
      if (el.getTag() !== null) {
        tag = "<i class='fa fa-tag'></i>" + el.getTag();
      }

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

    const tabDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_TAG}`);
    tabDiv.innerHTML = tag;
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
    const tabWidget = this._splitLayout.getTabWidgetByTabContent(tabContentElement);
    const tabWidgetContents = this._splitLayout.getTabContentsByTabWidget(tabWidget);

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
    
    const oldIndex = tabWidgetContents.indexOf(tabContentElement);
    if (tabWidgetContents.length >= 2) {
      this._switchToTab(tabWidgetContents[oldIndex === 0 ? 1 : oldIndex-1]);
    } else {
      this._switchToTab(this._splitLayout.getTabContentsByTabWidget(tabWidget)[0]);
    }

    this._sendTabClosedEvent();
  }

  private _switchToTab(tabContentElement: Element): void {
    this._splitLayout.showTabByTabContent(tabContentElement);
    this._focusTabContent(tabContentElement);
  }

  private _shiftTab(tabWidget: TabWidget, direction: number): void {
    const contents = this._splitLayout.getTabContentsByTabWidget(tabWidget);
    const len = contents.length;
    if (len === 0) {
      return;
    }
    
    let i = tabWidget.getSelectedIndex();
    i = i + direction;
    if (i < 0) {
      i = len - 1;
    } else if (i >= len) {
      i = 0;
    }
    tabWidget.setSelectedIndex(i);
    this._focusTabContent(contents[i]);
  }

  focusPane(): void {
    // FIXME
  }

  private _selectPaneLeft(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._selectPaneInDirection(tabElement, this._splitLayout.getTabWidgetToLeft);
  }

  private _selectPaneRight(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._selectPaneInDirection(tabElement, this._splitLayout.getTabWidgetToRight);
  }

  private _selectPaneAbove(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._selectPaneInDirection(tabElement, this._splitLayout.getTabWidgetAbove);
  }

  private _selectPaneBelow(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._selectPaneInDirection(tabElement, this._splitLayout.getTabWidgetBelow);
  }

  private _selectPaneInDirection(tabElement: Element, directionFunc: (tabWidget: TabWidget) => TabWidget):
      { tabWidget: TabWidget, tabContent: Element} {

    const currentTabWidget = this._splitLayout.getTabWidgetByTabContent(tabElement);
    const targetTabWidget = directionFunc.call(this._splitLayout, currentTabWidget);
    if (targetTabWidget != null) {
      targetTabWidget.focus();
      const content = this._splitLayout.getTabContentByTab(targetTabWidget.getSelectedTab());
      if (elementSupportsFocus(content)) {
        content.focus();
        return { tabWidget: targetTabWidget, tabContent: content };
      }
      return { tabWidget: targetTabWidget, tabContent: null };
    }
    return { tabWidget: null, tabContent: null };
  }

  private _moveTabElementLeft(tabElement: Element): void {
    this._moveTabElementInDirection(tabElement, this._splitLayout.getTabWidgetToLeft);
  }

  private _moveTabElementRight(tabElement: Element): void {
    this._moveTabElementInDirection(tabElement, this._splitLayout.getTabWidgetToRight);
  }

  private _moveTabElementUp(tabElement: Element): void {
    this._moveTabElementInDirection(tabElement, this._splitLayout.getTabWidgetAbove);
  }

  private _moveTabElementDown(tabElement: Element): void {
    this._moveTabElementInDirection(tabElement, this._splitLayout.getTabWidgetBelow);
  }

  private _moveTabElementInDirection(tabElement: Element, directionFunc: (tabWidget: TabWidget) => TabWidget): void {
    const currentTabWidget = this._splitLayout.getTabWidgetByTabContent(tabElement);
    const targetTabWidget = directionFunc.call(this._splitLayout, currentTabWidget);
    if (targetTabWidget != null) {
      this._splitLayout.moveTabToTabWidget(this._splitLayout.getTabByTabContent(tabElement), targetTabWidget, 0);
      this._splitLayout.update();
      targetTabWidget.focus();
      if (elementSupportsFocus(tabElement)) {
        tabElement.focus();
      }      
    }
  }

  private _getTabElementWithFocus(): Element {
    for (const el of this._splitLayout.getAllTabContents()) {
      if (elementSupportsFocus(el)) {
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
    } else if (elementSupportsFocus(el)) {
      el.focus();
    }
  }

  private _horizontalSplit(tabContentElement: Element): void {
    this._split(tabContentElement, SplitOrientation.HORIZONTAL);
  }

  private _verticalSplit(tabContentElement: Element): void {
    this._split(tabContentElement, SplitOrientation.VERTICAL);
  }

  private _split(tabContentElement: Element, orientation: SplitOrientation): void {
    const newTabWidget = this._splitLayout.splitAfterTabContent(tabContentElement, orientation);
    this._splitLayout.update();
    this._refreshSplitLayout();
    if (newTabWidget != null) {
      const element = this._splitLayout.getEmptyContentByTabWidget(newTabWidget);
      if (element != null) {
        newTabWidget.focus();
        if (element instanceof EmptyPaneMenu) {
          element.focus();
        }
      } else {
        const tabWidget = this._splitLayout.getTabWidgetByTabContent(tabContentElement);
        tabWidget.focus();
        if (elementSupportsFocus(tabContentElement)) {
          tabContentElement.focus();
        }
      }
    }
  }

  private _refreshSplitLayout(): void {
    const rootContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);
    const firstKid = rootContainer.children.item(0);
    if (firstKid instanceof Splitter || firstKid instanceof TabWidget) {
      firstKid.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
    }
  }

  private _closeSplit(tabContentElement: Element): void {
    let focusInfo: {tabWidget: TabWidget, tabContent: Element} = null;
    if (tabContentElement instanceof EmptyPaneMenu) {
      focusInfo = this._selectPaneLeft(tabContentElement);
      if (focusInfo.tabWidget == null) {
        focusInfo = this._selectPaneRight(tabContentElement);
        if (focusInfo.tabWidget == null) {
          focusInfo = this._selectPaneAbove(tabContentElement);
          if (focusInfo.tabWidget == null) {
            focusInfo = this._selectPaneBelow(tabContentElement);
          }
        }
      }
    }

    this._splitLayout.closeSplitAtTabContent(tabContentElement);
    this._splitLayout.update();
    this._refreshSplitLayout();

    if (focusInfo == null) {
      const tabWidget = this._splitLayout.getTabWidgetByTabContent(tabContentElement);
      focusInfo = {tabWidget, tabContent: tabContentElement};
    }

    if (focusInfo.tabWidget != null) {
      focusInfo.tabWidget.focus();
      if (focusInfo.tabContent != null) {
        if (elementSupportsFocus(focusInfo.tabContent)) {
          focusInfo.tabContent.focus();
        }
      }
    }
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
    ResizeRefreshElementBase.ResizeRefreshElementBase.refreshChildNodes(
      DomUtils.getShadowId(this, ID_MAIN_CONTENTS), level);
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

    return this._commandPaletteEntriesWithTarget(tabContentElement, this._tabWidgetFromElement(tabContentElement), target);
  }

  private _commandPaletteEntriesWithTarget(tabContentElement: Element, tabWidget: TabWidget, target: CommandPaletteRequestTypes.Commandable):
      CommandPaletteRequestTypes.CommandEntry[] {

    const commandList: CommandPaletteRequestTypes.CommandEntry[] = [
      { id: COMMAND_NEW_TERMINAL, group: PALETTE_GROUP, iconRight: "plus", label: "New Terminal", target: target },
      { id: COMMAND_CLOSE_TAB, group: PALETTE_GROUP, iconRight: "times", label: "Close Tab", target: target },
      { id: COMMAND_SELECT_TAB_LEFT, group: PALETTE_GROUP, label: "Select Previous Tab", target: target },
      { id: COMMAND_SELECT_TAB_RIGHT, group: PALETTE_GROUP, label: "Select Next Tab", target: target },

      { id: COMMAND_SELECT_PANE_LEFT, group: PALETTE_GROUP, label: " Select pane left", target: target },
      { id: COMMAND_SELECT_PANE_RIGHT, group: PALETTE_GROUP, label: " Select pane right", target: target },
      { id: COMMAND_SELECT_PANE_ABOVE, group: PALETTE_GROUP, label: " Select pane above", target: target },
      { id: COMMAND_SELECT_PANE_BELOW, group: PALETTE_GROUP, label: " Select pane below", target: target },

      { id: COMMAND_HORIZONTAL_SPLIT, group: PALETTE_GROUP, iconRight: "extraicon-#xea08", label: "Horizontal Split", target: target },
      { id: COMMAND_VERTICAL_SPLIT, group: PALETTE_GROUP, iconRight: "columns", label: "Vertical Split", target: target },

      { id: COMMAND_MOVE_TAB_LEFT, group: PALETTE_GROUP, label: "Move Tab Left", target: target },
      { id: COMMAND_MOVE_TAB_RIGHT, group: PALETTE_GROUP, label: "Move Tab Right", target: target },
      { id: COMMAND_MOVE_TAB_UP, group: PALETTE_GROUP, label: "Move Tab Up", target: target },
      { id: COMMAND_MOVE_TAB_DOWN, group: PALETTE_GROUP, label: "Move Tab Down", target: target },
    ];
// FIXME
    if (tabWidget != null && tabWidget.parentElement instanceof Splitter ||
        tabContentElement instanceof EmptyPaneMenu) {

      commandList.push( { id: COMMAND_CLOSE_PANE, group: PALETTE_GROUP, label: "Close Pane", target: target } );
    }

    this._insertCommandKeyBindings(commandList);
    return commandList;
  }

  private _insertCommandKeyBindings(commandList: CommandPaletteRequestTypes.CommandEntry[]): void {
    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_MAIN_UI);
    if (keyBindings !== null) {
      commandList.forEach( (commandEntry) => {
        const shortcut = keyBindings.mapCommandToKeyBinding(commandEntry.id)
        commandEntry.shortcut = shortcut === null ? "" : shortcut;
      });
    }    
  }
  
  private _executeCommand(tabElement: Element, command: string): boolean {
    switch (command) {
      case COMMAND_SELECT_TAB_LEFT:
        this._shiftTab(this._tabWidgetFromElement(tabElement), -1);
        break;
        
      case COMMAND_SELECT_TAB_RIGHT:
        this._shiftTab(this._tabWidgetFromElement(tabElement), 1);
        break;

      case COMMAND_SELECT_PANE_LEFT:
        this._selectPaneLeft(tabElement);
        break;

      case COMMAND_SELECT_PANE_RIGHT:
        this._selectPaneRight(tabElement);
        break;

      case COMMAND_SELECT_PANE_ABOVE:
        this._selectPaneAbove(tabElement);
        break;

      case COMMAND_SELECT_PANE_BELOW:
        this._selectPaneBelow(tabElement);
        break;

      case COMMAND_NEW_TERMINAL:
        this._switchToTab(this.newTerminalTab(this._tabWidgetFromElement(tabElement)));
        break;
        
      case COMMAND_CLOSE_TAB:
        this.closeTab(tabElement);
        break;

      case COMMAND_HORIZONTAL_SPLIT:
        this._horizontalSplit(tabElement);
        break;

      case COMMAND_VERTICAL_SPLIT:
        this._verticalSplit(tabElement);
        break;

      case COMMAND_CLOSE_PANE:
        this._closeSplit(tabElement);
        break;

      case COMMAND_MOVE_TAB_LEFT:
        this._moveTabElementLeft(tabElement);
        break;

      case COMMAND_MOVE_TAB_RIGHT:
        this._moveTabElementRight(tabElement);
        break;

      case COMMAND_MOVE_TAB_UP:
        this._moveTabElementUp(tabElement);
        break;

      case COMMAND_MOVE_TAB_DOWN:
        this._moveTabElementDown(tabElement);
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

interface Focusable {
  focus(): void;
  hasFocus(): boolean;
}

function elementSupportsFocus(content: Element | Focusable): content is Focusable {
  return content instanceof EtTerminal || content instanceof EmptyPaneMenu || content instanceof EtViewerTab
}
