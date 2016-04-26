/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import domutils = require('./domutils');
import util = require('./gui/util');
import ThemeableElementBase = require('./themeableelementbase');
import TabWidget = require('./gui/tabwidget');
import resourceLoader = require('./resourceloader');
import EtTerminal = require('./terminal');
import EtSettingsTab = require('./settings/settingstab2');
import EtAboutTab = require('./abouttab');
import EtViewerTab = require('./viewertab');
import EtEmbeddedViewer = require('./embeddedviewer');
import CbTab = require('./gui/tab');
import ViewerElement = require('./viewerelement');
import ViewerElementTypes = require('./viewerelementtypes');
import ThemeTypes = require('./theme');
import webipc = require('./webipc');
import Messages = require('./windowmessages');
import path = require('path');
import _ = require('lodash');
import config = require('./config');
import he = require('he');
import FrameFinderType = require('./framefindertype');
type FrameFinder = FrameFinderType.FrameFinder;
import LogDecorator = require('./logdecorator');
import KeyBindingManager = require('./keybindingmanager');

import Logger = require('./logger');

const log = LogDecorator;

type Config = config.Config;
type SessionProfile = config.SessionProfile;
const VisualState = ViewerElementTypes.VisualState;

const ID = "ExtratermMainWebUITemplate";

const ID_TOP = "ID_TOP";
const ID_PANE_LEFT = "ID_PANE_LEFT";
const ID_PANE_RIGHT = "ID_PANE_RIGHT";
const ID_GAP = "ID_GAP";
const ID_TAB_CONTAINER_LEFT = "ID_TAB_CONTAINER_LEFT";
const ID_TAB_CONTAINER_RIGHT = "ID_TAB_CONTAINER_RIGHT";
const ID_REST_DIV_PRIMARY = "ID_REST_DIV_PRIMARY";
const ID_REST_DIV_SECONDARY = "ID_REST_DIV_SECONDARY";
const ID_NEW_TAB_BUTTON_PRIMARY = "ID_NEW_TAB_BUTTON_PRIMARY";
const ID_NEW_TAB_BUTTON_SECONDARY = "ID_NEW_TAB_BUTTON_SECONDARY";
const CLASS_SPLIT = "split";

const CLASS_TAB_HEADER_CONTAINER = "tab_header_container";
const CLASS_TAB_HEADER_ICON = "tab_header_icon";
const CLASS_TAB_HEADER_MIDDLE = "tab_header_middle";
const CLASS_TAB_HEADER_CLOSE = "tab_header_close";

const KEYBINDINGS_MAIN_UI = "main-ui";
const COMMAND_SELECT_TAB_LEFT = "selectTabLeft";
const COMMAND_SELECT_TAB_RIGHT = "selectTabRight";
const COMMAND_NEW_TAB = "newTab";
const COMMAND_SELECT_OTHER_PANE = "selectOtherPane";
const COMMAND_CLOSE_TAB = "closeTab";
const COMMAND_TOGGLE_SPLIT = "toggleSplit";

let registered = false;

const enum TabPosition {
  LEFT,
  RIGHT
}

enum TabType {
  TERMINAL,
  VIEWER
}

/**
 * Class for holding info about the contents of our tabs.
 */
class TabInfo {
  
  id: number;
  
  position: TabPosition;
  
  contentDiv: HTMLDivElement;
  
  cbTab: CbTab;
  
  constructor() {
  }
  
  wasShown: boolean = false;
  
  lastFocus: boolean = false; // True if this tab had the focus last.
  
  title(): string {
    return "";
  }
  
  htmlTitle(): string {
    return he.escape(this.title());
  }
  
  tabIcon(): string {
    return null;
  }
  
  updateTabTitle(): void {
    const iconDiv = <HTMLDivElement> this.cbTab.querySelector(`DIV.${CLASS_TAB_HEADER_ICON}`);
    const icon = this.tabIcon();
    iconDiv.innerHTML = icon !== null ? '<i class="fa fa-' + icon + '"></i>' : "";
    
    const middleDiv = <HTMLDivElement> this.cbTab.querySelector(`DIV.${CLASS_TAB_HEADER_MIDDLE}`);
    middleDiv.title = this.title();
    middleDiv.innerHTML = this.htmlTitle();
  }
  
  focus(): void { }
  
  resize(): void { }
  
  hasFocus(): boolean {
    return false;
  }
  
  setConfig(config: Config): void {
    
  }
  
  setKeyBindingContexts(contexts: KeyBindingManager.KeyBindingContexts): void {
    
  }
  
  destroy(): void { }
  
  copyToClipboard(): void { }
  
  pasteText(text: string ): void { }
  
  getFrameContents(frameId: string): string {
    return null;
  }  
}

/**
 * A tab which contains a terminal.
 */
class TerminalTabInfo extends TabInfo {
  
  constructor(public terminal: EtTerminal, public ptyId: number) {
    super();
  }
  
  title(): string {
    return this.terminal.terminalTitle;
  }
  
  tabIcon(): string {
    return "keyboard-o";
  }  
  
  focus(): void {
    this.terminal.resizeToContainer();
    this.terminal.focus();
  }
  
  resize(): void {
    this.terminal.resize();
  }
  
  hasFocus(): boolean {
    return this.terminal.hasFocus();
  }
  
  setConfig(config: Config): void {
    this.terminal.blinkingCursor = config.blinkingCursor;
    this.terminal.commandLineActions = config.commandLineActions !== undefined ? config.commandLineActions : null;
    this.terminal.scrollbackSize = config.scrollbackLines;
  }
  
  destroy(): void {
    this.terminal.destroy();
    
    if (this.ptyId !== null) {
      webipc.ptyClose(this.ptyId);
    }
  }
  
  copyToClipboard(): void {
    this.terminal.copyToClipboard();
  }
  
  pasteText(text: string ): void {
    this.terminal.pasteText(text);
  }
  
  getFrameContents(frameId: string): string {
    return this.terminal.getFrameContents(frameId);
  }  
  
  setKeyBindingContexts(contexts: KeyBindingManager.KeyBindingContexts): void {
    this.terminal.keyBindingContexts = contexts;
  }
}

/**
 * A tab which contains a viewer.
 */
class ViewerElementTabInfo extends TabInfo {
  constructor(public viewerElement: ViewerElement) {
    super();
  }
  
  tabIcon(): string {
    return this.viewerElement.awesomeIcon;
  }
  
  title(): string {
    return this.viewerElement.title;
  }
  
  focus(): void {
    this.viewerElement.focus();
  }
  
  hasFocus(): boolean {
    return this.viewerElement.hasFocus();
  }  
}

class ViewerTabInfo extends ViewerElementTabInfo {
  constructor(public viewer: EtViewerTab) {
    super(viewer);
  }

  htmlTitle(): string {
    if (this.viewer.tag !== null) {
      return he.escape(this.title()) + " &nbsp;&nbsp;&nbsp;<i class='fa fa-tag'></i>" + this.viewer.tag;
    } else {
      return he.escape(this.title());
    }
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
  constructor(public settingsElement: EtSettingsTab, public themes: ThemeTypes.ThemeInfo[]) {
    super(settingsElement);
    settingsElement.themes = themes;
  }
  
  setConfig(config: Config): void {
    this.settingsElement.config = config;
  }
}

class AboutTabInfo extends ViewerElementTabInfo {
  constructor(public aboutElement: EtAboutTab) {
    super(aboutElement);
  }
}

const staticLog = new Logger("Static ExtratermMainWebUI");

// Theme management
const activeInstances: Set<ExtratermMainWebUI> = new Set();
let themeCss = "";

/**
 * Top level UI component for a normal terminal window
 *
 */
class ExtratermMainWebUI extends ThemeableElementBase {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static init(): void {
    TabWidget.init();
    EtTerminal.init();
    EtSettingsTab.init();
    EtAboutTab.init();
    EtViewerTab.init();
    
    if (registered === false) {
      window.document.registerElement(ExtratermMainWebUI.TAG_NAME, {prototype: ExtratermMainWebUI.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME = 'extraterm-mainwebui';
  
  static EVENT_TAB_OPENED = 'mainwebui-tab-opened';
  
  static EVENT_TAB_CLOSED = 'mainwebui-tab-closed';
  
  static EVENT_TITLE = 'mainwebui-title';

  static EVENT_SPLIT = 'mainwebui-split';

  static POSITION_LEFT = TabPosition.LEFT;
  
  static POSITION_RIGHT = TabPosition.RIGHT;
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _tabInfo: TabInfo[];
  
  private _tabIdCounter: number;
  
  private _config: Config;

  private _themes: ThemeTypes.ThemeInfo[];

  private _split: boolean;

  private _keyBindingContexts: KeyBindingManager.KeyBindingContexts;
  
  private _initProperties(): void {
    this._log = new Logger("ExtratermMainWebUI");
    this._tabInfo = [];
    this._tabIdCounter = 0;
    this._config = null;
    this._themes = [];
    this._split = false;
    this._keyBindingContexts = null;
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
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    // Update the window title when the selected tab changes and resize the terminal.
    const tabWidgetLeft = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    tabWidgetLeft.addEventListener(TabWidget.EVENT_TAB_SWITCH, (e) => {
      this._handleTabSwitch(tabWidgetLeft, TabPosition.LEFT);
    });

    const tabWidgetRight = <TabWidget> this._getById(ID_TAB_CONTAINER_RIGHT);
    tabWidgetRight.addEventListener(TabWidget.EVENT_TAB_SWITCH, (e) => {
      this._handleTabSwitch(tabWidgetRight, TabPosition.RIGHT);
    });
    
    const newTabPrimaryButton = this._getById(ID_NEW_TAB_BUTTON_PRIMARY);
    newTabPrimaryButton.addEventListener('click', () => {
      this.focusTab(this.newTerminalTab(this._split ? TabPosition.RIGHT : TabPosition.LEFT));
    });
    
    const newTabSecondaryButton = this._getById(ID_NEW_TAB_BUTTON_SECONDARY);
    newTabSecondaryButton.addEventListener('click', () => {
      this.focusTab(this.newTerminalTab(this._split ? TabPosition.LEFT : TabPosition.RIGHT));
    });
    
    this._setupIpc();
  }

  private _createClone(): Node {
    var template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _html(): string {
    return `
    <style id="${ThemeableElementBase.ID_THEME}"></style>
    <div id="${ID_TOP}">` +
        `<div id="${ID_PANE_LEFT}">` +
          `<cb-tabwidget id="${ID_TAB_CONTAINER_LEFT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_PRIMARY}"><button class="btn btn-quiet" id="${ID_NEW_TAB_BUTTON_PRIMARY}"><i class="fa fa-plus"></i></button>` +
            `<content></content></div>` +
          `</cb-tabwidget>` +
        `</div>` +
        `<div id="${ID_GAP}"></div>` +
        `<div id="${ID_PANE_RIGHT}">` +
          `<cb-tabwidget id="${ID_TAB_CONTAINER_RIGHT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_SECONDARY}"><button class="btn btn-quiet" id="${ID_NEW_TAB_BUTTON_SECONDARY}"><i class="fa fa-plus"></i></button></div>` +
          `</cb-tabwidget>` +
        `</div>` +
      `</div>`;
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.MAIN_UI];
  }

  destroy(): void {
  }
  
  //-----------------------------------------------------------------------
  
  //-----------------------------------------------------------------------
  
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
  
  private _handleTabSwitch(tabWidget: TabWidget, position: TabPosition): void {
    const tabInfos = this._split ? this._tabInfo.filter( tabInfo => tabInfo.position === position ) : this._tabInfo;
    if (tabWidget.currentIndex >= 0 && tabWidget.currentIndex < tabInfos.length) {
      const tabInfo = tabInfos[tabWidget.currentIndex];
      
      this._sendTitleEvent(tabInfo.title());
      tabInfo.focus();
    }
  }
  
  set config(config: Config) {
    this._config = config;
    this._tabInfo.forEach( (tabInfo) => tabInfo.setConfig(config));
  }
  
  set themes(themes: ThemeTypes.ThemeInfo[]) {
    this._themes = themes;
  }
  
  get tabCount(): number {
    return this._tabInfo.length;
  }
  
  set split(split: boolean) {
    if (split === this._split) {
      return;
    }

    const top = this._getById(ID_TOP);
    const tabContainerLeft = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    const tabContainerRight = <TabWidget> this._getById(ID_TAB_CONTAINER_RIGHT);
    const restDivPrimary = this._getById(ID_REST_DIV_PRIMARY);
    const restDivSecondary = this._getById(ID_REST_DIV_SECONDARY);
    
    if (split) {
      // Split it in two.

      const currentTab = tabContainerLeft.currentTab;
      const selectedTabInfo = _.first(this._tabInfo.filter( tabInfo => tabInfo.cbTab === currentTab ));

      top.classList.add(CLASS_SPLIT);
      // The primary controls have the burger menu. When it is split, the controls are moved to the right side.
      
      this._tabInfo.filter( tabInfo => tabInfo.position === TabPosition.RIGHT )
        .forEach( tabInfo => {
          tabContainerRight.appendChild(tabInfo.cbTab);
          tabContainerRight.appendChild(tabInfo.contentDiv);
        });
      
      tabContainerRight.appendChild(restDivPrimary);
      tabContainerLeft.appendChild(restDivSecondary);
      
      tabContainerLeft.update();
      tabContainerRight.update();
      
      // Select the right tabs and set focus.
      const tabContainer = selectedTabInfo.position === TabPosition.LEFT ? tabContainerLeft : tabContainerRight
      const otherTabContainer = selectedTabInfo.position !== TabPosition.LEFT ? tabContainerLeft : tabContainerRight;
        
      tabContainer.currentTab = selectedTabInfo.cbTab;
      selectedTabInfo.focus();
        
      const otherShownList = this._tabInfo.filter(
                                tabInfo => tabInfo.position !== selectedTabInfo.position && tabInfo.wasShown);
      if (otherShownList.length !== 0) {
        otherTabContainer.currentTab = otherShownList[0].cbTab;
      } else {
        otherTabContainer.currentIndex = 0;
      }
      
    } else {
      // Go from a split with two panes to just one pane.

      // Keep track of which tabs were being shown so that we can make split reversable.
      const leftList = this._tabInfo.filter( tabInfo => tabInfo.position === TabPosition.LEFT );
      const leftSelectedTab = tabContainerLeft.currentTab;
      leftList.forEach( (tabInfo, i) => {
        tabInfo.wasShown = tabInfo.cbTab === leftSelectedTab;
      });
      
      const rightList = this._tabInfo.filter( tabInfo => tabInfo.position === TabPosition.RIGHT );
      const rightSelectedTab = tabContainerRight.currentTab;
      rightList.forEach( (tabInfo, i) => {
        tabInfo.wasShown = tabInfo.cbTab === rightSelectedTab;
      });
      
      const focusedList = this._tabInfo.filter( tabInfo => tabInfo.hasFocus() );

      // Move the 'rest' DIV from the right to the left.
      top.classList.remove(CLASS_SPLIT);
      tabContainerLeft.appendChild(restDivPrimary);
      tabContainerRight.appendChild(restDivSecondary);
      
      // Move the terminal tabs from the right tab container to the left one.
      const nodesToMove = domutils.nodeListToArray(tabContainerRight.childNodes)
        .filter( node => ! (node.nodeName === "DIV" && ( (<HTMLDivElement>node).id === ID_REST_DIV_PRIMARY ||
          (<HTMLDivElement>node).id === ID_REST_DIV_SECONDARY)));
      nodesToMove.forEach( node => {
        tabContainerLeft.insertBefore(node, restDivPrimary);
        });
      
      // Fix up the list of terminal info objects
      this._tabInfo = [...this._tabInfo.filter( info => info.position == TabPosition.LEFT ),
                            ...this._tabInfo.filter( info => info.position == TabPosition.RIGHT)];
         
      tabContainerLeft.update();
      // Try to focus and show the same tab.
      if (focusedList.length !== 0) {
        tabContainerLeft.currentTab = focusedList[0].cbTab;
        focusedList[0].focus();
      }
    }
    
    this._split = split;
    this._resize();
  }
  
  get split(): boolean {
    return this._split;
  }
  
  resize(): void {
    this._resize();
  }
  
  set keyBindingContexts(keyBindingContexts: KeyBindingManager.KeyBindingContexts) {
    this._keyBindingContexts = keyBindingContexts;
    
    this._tabInfo.forEach( (tabInfo) => {
      tabInfo.setKeyBindingContexts(keyBindingContexts);
    });
  }
  
  get keyBindingContexts() : KeyBindingManager.KeyBindingContexts {
    return this._keyBindingContexts;
  }
  
  /**
   * Initialise and insert a tab.
   * 
   * @param {TabPosition} position where to insert the tab, which pane.
   * @param {TabInfo}     tabInfo  Object describing the tab.
   */
  private _addTab(position: TabPosition, tabInfo: TabInfo): void {
    const newId = this._tabIdCounter;
    this._tabIdCounter++;
    const newCbTab = <CbTab> document.createElement(CbTab.TAG_NAME);
    newCbTab.setAttribute('id', "tab_id_"+newId);
    newCbTab.innerHTML =
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
    tabInfo.position = position;
    tabInfo.cbTab = newCbTab;
    tabInfo.contentDiv = contentDiv;
    this._tabInfo.push(tabInfo);
    
    const tabWidget = <TabWidget> this._getById(
                        position === TabPosition.LEFT ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT);
                        
    // The way the split view changes the position of the 'rest' controls
    // in the tab widgets causes this expression below.
    const restDiv = this._getById(
                        this._split === (position === TabPosition.LEFT) ? ID_REST_DIV_SECONDARY : ID_REST_DIV_PRIMARY);
    
    tabWidget.insertBefore(newCbTab, restDiv);
    tabWidget.insertBefore(contentDiv, restDiv);
    tabWidget.update();
    
    const closeTabButton = domutils.getShadowRoot(this).getElementById("close_tag_id_" + newId);
    closeTabButton.addEventListener('click', (ev: MouseEvent): void => {
      this.closeTab(tabInfo.id);
    });
    
    // Key press event
    tabInfo.contentDiv.addEventListener('keydown', this._handleKeyDownCapture.bind(this, tabInfo), true);
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(position: TabPosition): number {
    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    newTerminal.frameFinder = this._frameFinder.bind(this);
    const tabInfo = new TerminalTabInfo(newTerminal, null);
    tabInfo.setKeyBindingContexts(this._keyBindingContexts);
    this._addTab(position, tabInfo);
    
    tabInfo.contentDiv.appendChild(newTerminal);
    
    newTerminal.addEventListener('focus', (ev: FocusEvent) => {
      this._tabInfo.forEach( tabInfo2 => {
        tabInfo2.lastFocus = tabInfo2 === tabInfo;
      });
    });
    
    // User input event
    newTerminal.addEventListener(EtTerminal.EVENT_USER_INPUT, (ev: CustomEvent): void => {
      if (tabInfo.ptyId !== null) {
        webipc.ptyInput(tabInfo.ptyId, (<any> ev).detail.data);
      }
    });
    
    let currentColumns = newTerminal.columns;
    let currentRows = newTerminal.rows;

    // Terminal resize event
    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_RESIZE, (ev: CustomEvent): void => {
      currentColumns = (<any> ev).detail.columns;
      currentRows = (<any> ev).detail.rows;
      if (tabInfo.ptyId !== null) {
        webipc.ptyResize(tabInfo.ptyId, currentColumns, currentRows);
      }
    });

    // Terminal title event
    newTerminal.addEventListener(EtTerminal.EVENT_TITLE, (ev: CustomEvent): void => {
      tabInfo.updateTabTitle();
      this._sendTitleEvent(ev.detail.title);
    });
    
    newTerminal.addEventListener(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT, (ev: CustomEvent): void => {
      this.focusTab(this.openViewerTab(tabInfo.position, ev.detail.embeddedViewer));
      ev.detail.terminal.deleteEmbeddedViewer(ev.detail.embeddedViewer);
    });

    tabInfo.setConfig(this._config);
    
    const sessionProfile = this._config.expandedProfiles[0];
    const newEnv = _.cloneDeep(process.env);
    const expandedExtra = sessionProfile.extraEnv;

    let prop: string;
    for (prop in expandedExtra) {
      newEnv[prop] = expandedExtra[prop];
    }
    
    webipc.requestPtyCreate(sessionProfile.command, sessionProfile.arguments,
        currentColumns, currentRows, newEnv)
      .then( (msg: Messages.CreatedPtyMessage) => {
        tabInfo.ptyId = msg.id;
        webipc.ptyResize(tabInfo.ptyId, currentColumns, currentRows);
      });

    tabInfo.updateTabTitle();
    this._sendTabOpenedEvent();
    return tabInfo.id;
  }
  
  openViewerTab(position: TabPosition, embeddedViewer: EtEmbeddedViewer): number {
    const viewerElement = embeddedViewer.viewerElement;
    const viewerTab = <EtViewerTab> document.createElement(EtViewerTab.TAG_NAME);
    
    viewerTab.title = embeddedViewer.title;
    viewerTab.tag = embeddedViewer.tag;
    
    const tabInfo = new ViewerTabInfo(viewerTab);
    viewerElement.mode = ViewerElementTypes.Mode.SELECTION;
    viewerElement.visualState = VisualState.AUTO;
    const result = this._openViewerTabInfo(position, tabInfo, viewerTab);
    viewerTab.viewerElement = viewerElement;
    tabInfo.updateTabTitle();
    return result;
  }
  
  _openViewerTabInfo(position: TabPosition, tabInfo: ViewerElementTabInfo, viewerElement: ViewerElement): number {
    viewerElement.focusable = true;
    tabInfo.setConfig(this._config);
    this._addTab(position, tabInfo);
    tabInfo.contentDiv.appendChild(viewerElement);

    viewerElement.addEventListener('focus', (ev: FocusEvent) => {
      this._tabInfo.forEach( tabInfo2 => {
        tabInfo2.lastFocus = tabInfo2 === tabInfo;
      });
    });

    viewerElement.addEventListener(EtSettingsTab.EVENT_CONFIG_CHANGE, (ev: CustomEvent) => {
      webipc.sendConfig(ev.detail.data);
    });

    tabInfo.updateTabTitle();
    this._sendTabOpenedEvent();
    return tabInfo.id;
  }
  
  openSettingsTab(): void {
    const settingsTabs = this._tabInfo.filter( (tabInfo) => tabInfo instanceof SettingsTabInfo );
    if (settingsTabs.length !== 0) {
      this.focusTab(settingsTabs[0].id);
    } else {
      const viewerElement = <EtSettingsTab> document.createElement(EtSettingsTab.TAG_NAME);
      const tabInfo = new SettingsTabInfo(viewerElement, this._themes);
      this.focusTab(this._openViewerTabInfo(TabPosition.LEFT, tabInfo, viewerElement));
    }
  }
  
  openAboutTab(): void {
    const aboutTabs = this._tabInfo.filter( (tabInfo) => tabInfo instanceof AboutTabInfo );
    if (aboutTabs.length !== 0) {
      this.focusTab(aboutTabs[0].id);
    } else {
      const viewerElement = <EtAboutTab> document.createElement(EtAboutTab.TAG_NAME);
      const tabInfo = new AboutTabInfo(viewerElement);
      this.focusTab(this._openViewerTabInfo(TabPosition.LEFT, tabInfo, viewerElement));
    }
  }
  
  /**
   *
   */
  closeTab(tabId: number): void {
    const matches = this._tabInfo.filter( (p) => p.id === tabId );
    if (matches.length === 0) {
      return;
    }
    const tabInfo = matches[0];
    const position = tabInfo.position;
    
    let paneTabInfos = this._tabInfo.filter( tabInfo2 => tabInfo2.position === position );
    
    let index = paneTabInfos.indexOf(tabInfo);
    
    // Remove the tab from the list.
    this._tabInfo = this._tabInfo.filter( (p) => p.id !== tabId );
    paneTabInfos = paneTabInfos.filter( tabInfo2 => tabInfo2.id !== tabId );

    tabInfo.contentDiv.parentNode.removeChild(tabInfo.contentDiv);
    tabInfo.cbTab.parentNode.removeChild(tabInfo.cbTab);
    tabInfo.destroy();

    const tabContainer = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    tabContainer.update();
    const tabContainer2 = <TabWidget> this._getById(ID_TAB_CONTAINER_RIGHT);
    tabContainer2.update();
    
    this._sendTabClosedEvent();
    
    paneTabInfos = this._split ? this._tabInfo.filter( tabInfo2 => tabInfo2.position === position ) : this._tabInfo;
    
    if (index >= paneTabInfos.length) {
      index--;
    }
    if (paneTabInfos.length !== 0) {
      this.focusTab(paneTabInfos[index].id);
    } else {
      this.focusPane(tabInfo.position === TabPosition.LEFT ? TabPosition.RIGHT : TabPosition.LEFT);
    }
  }

  focusTab(terminalId: number): void {
    let leftIndex = 0;
    let rightIndex = 0;
    for (let i=0; i<this._tabInfo.length; i++) {
      const tabInfo = this._tabInfo[i];
      if (tabInfo.id === terminalId) {
        const tabWidget = <TabWidget> this._getById(
          tabInfo.position === TabPosition.LEFT ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT);
        tabWidget.currentIndex = tabInfo.position === TabPosition.LEFT ? leftIndex : rightIndex;
        tabInfo.focus();
        return;
      }
      
      if (tabInfo.position === TabPosition.LEFT) {
        leftIndex++;
      } else {
        rightIndex++;
      }
    }
  }

  /**
   * Gives the input focus to the other (non-focussed) pane.
   */
  focusOtherPane(): void {
    if ( ! this._split) {
      return;
    }
    
    const focussedTabInfos = this._tabInfo.filter( tabInfo => tabInfo.hasFocus() );
    if (focussedTabInfos.length === 0) {
      return;
    }
    
    // Get the other tab container, the one we want to focus to.
    const focussedTabInfo = focussedTabInfos[0];
    const position = focussedTabInfo.position;
    this.focusPane(position === TabPosition.LEFT ? TabPosition.RIGHT : TabPosition.LEFT);    
  }

  focusPane(position: TabPosition): void {
    const tabContainer = <TabWidget> this._getById(position === TabPosition.LEFT
      ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT);
    if (tabContainer.currentIndex < 0) {
      return;
    }
    
    // Figure out the terminal object associated with the currently shown tab inside the tab container.
    const tabsInfos = this._tabInfo.filter( tabInfo => tabInfo.position === position);
    if (tabsInfos.length !== 0) {
      tabsInfos[tabContainer.currentIndex].focus(); // Give it the focus.
    }
  }

  /**
   * Copys the selection in the focussed terminal to the clipboard.
   */
  copyToClipboard(): void {
    const termsWithFocus = this._tabInfo.filter( tabInfo => tabInfo.hasFocus() );
    if (termsWithFocus.length === 0) {
      return;
    }
    termsWithFocus[0].copyToClipboard();
  }
  
  /**
   * Pastes text into the terminal which has the input focus.
   *
   * @param text the text to paste.
   */
  pasteText(text: string): void {
    const termsWithFocus = this._tabInfo.filter( tabInfo => tabInfo.hasFocus() );
    if (termsWithFocus.length === 0) {
      this._log.warn("pasteText() couldn't find the target tab.");
      return;
    }
    termsWithFocus[0].pasteText(text);
  }
  
  //-----------------------------------------------------------------------
  private _resize(): void {
    const tabWidgetLeft = <TabWidget> this._getById(ID_TAB_CONTAINER_LEFT);
    tabWidgetLeft.resize();
    const tabWidgetRight = <TabWidget> this._getById(ID_TAB_CONTAINER_RIGHT);
    tabWidgetRight.resize();
  }

  private _sendTabOpenedEvent(): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_TAB_OPENED, { detail: null });
    this.dispatchEvent(event);
  }
  
  private _sendTabClosedEvent(): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_TAB_CLOSED, { detail: null });
    this.dispatchEvent(event);    
  }

  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_TITLE, { detail: {title: title} });
    this.dispatchEvent(event);
  }
  
  private _sendSplitEvent(): void {
    const event = new CustomEvent(ExtratermMainWebUI.EVENT_SPLIT, {  });
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
    if (this._keyBindingContexts === null) {
      return;
    }
    
    const bindings = this._keyBindingContexts.context(KEYBINDINGS_MAIN_UI);
    if (bindings === null) {
      return;
    }
    
    const command = bindings.mapEventToCommand(ev);
    switch (command) {
      case COMMAND_SELECT_TAB_LEFT:
        this._shiftTab(tabInfo.position, -1);
        break;
        
      case COMMAND_SELECT_TAB_RIGHT:
        this._shiftTab(tabInfo.position, 1);
        break;
        
      case COMMAND_NEW_TAB:
        this.focusTab(this.newTerminalTab(tabInfo.position));
        break;
        
      case COMMAND_SELECT_OTHER_PANE:
        this.focusOtherPane();
        break;
        
      case COMMAND_CLOSE_TAB:
        this.closeTab(tabInfo.id);
        break;
        
      case COMMAND_TOGGLE_SPLIT:
        this.split = ! this._split;
        this._sendSplitEvent();
        break;
        
      default:
        return;
    }
    ev.stopPropagation();
  }

  //-----------------------------------------------------------------------
  // PTY and IPC handling
  //-----------------------------------------------------------------------
  private _setupIpc(): void {
    webipc.registerDefaultHandler(Messages.MessageType.PTY_OUTPUT, this._handlePtyOutput.bind(this));
    webipc.registerDefaultHandler(Messages.MessageType.PTY_CLOSE, this._handlePtyClose.bind(this));
  }
  
  private _handlePtyOutput(msg: Messages.PtyOutput): void {
    this._tabInfo.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo && (<TerminalTabInfo>tabInfo).ptyId === msg.id) {
        tabInfo.terminal.write(msg.data);
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
  
  private _shiftTab(position: TabPosition, direction: number): void {
    const shortTabList = this._split
                            ? this._tabInfo.filter( tabInfo => tabInfo.position === position)
                            : this._tabInfo;
    const len = shortTabList.length;
    if (len === 0) {
      return;
    }
    
    const tabWidgetId = (this._split===false || position === TabPosition.LEFT)
                          ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT;
    const tabWidget = <TabWidget> this._getById(tabWidgetId);
    let i = tabWidget.currentIndex;
    i = i + direction;
    if (i < 0) {
      i = len - 1;
    } else if (i >= len) {
      i = 0;
    }
    tabWidget.currentIndex = i;
    shortTabList[i].focus();
  }
  
  private _getById(id: string): HTMLElement {
    return <HTMLElement>domutils.getShadowRoot(this).querySelector('#'+id);
  }
}

export = ExtratermMainWebUI;
