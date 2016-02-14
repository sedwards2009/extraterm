/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import domutils = require('./domutils');
import util = require('./gui/util');
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
import webipc = require('./webipc');
import Messages = require('./windowmessages');
import path = require('path');
import _ = require('lodash');
import config = require('./config');
import globalcss = require('./gui/globalcss');
import he = require('he');
import FrameFinderType = require('./framefindertype');
type FrameFinder = FrameFinderType.FrameFinder;

import Logger = require('./logger');

type Config = config.Config;
type SessionProfile = config.SessionProfile;
const VisualState = ViewerElementTypes.VisualState;

const ID = "ExtratermMainWebUITemplate";

const ID_TOP = "top";
const ID_PANE_LEFT = "pane_left";
const ID_PANE_RIGHT = "pane_right";
const ID_TAB_CONTAINER_LEFT = "container_left";
const ID_TAB_CONTAINER_RIGHT = "container_right";
const ID_REST_DIV_PRIMARY = "rest_primary";
const ID_REST_DIV_SECONDARY = "rest_secondary";
const ID_NEW_TAB_BUTTON_PRIMARY = "new_tab_primary";
const ID_NEW_TAB_BUTTON_SECONDARY = "new_tab_secondary";
const CLASS_SPLIT = "split";

const TAB_HEADER_CONTAINER_CLASS = "tab_header_container";
const TAB_HEADER_ICON_CLASS = "tab_header_icon";
const TAB_HEADER_MIDDLE_CLASS = "tab_header_middle";
const TAB_HEADER_CLOSE_CLASS = "tab_header_close";


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
    const iconDiv = <HTMLDivElement> this.cbTab.querySelector(`DIV.${TAB_HEADER_ICON_CLASS}`);
    const icon = this.tabIcon();
    iconDiv.innerHTML = icon !== null ? '<i class="fa fa-' + icon + '"></i>' : "";
    
    const middleDiv = <HTMLDivElement> this.cbTab.querySelector(`DIV.${TAB_HEADER_MIDDLE_CLASS}`);
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
    this.terminal.resizeToContainer();
  }
  
  hasFocus(): boolean {
    return this.terminal.hasFocus();
  }
  
  setConfig(config: Config): void {
    this.terminal.blinkingCursor = config.blinkingCursor;
    this.terminal.themeCssPath = path.join(config.themePath, "theme.css").replace(/\\/g, "/");
    this.terminal.noFrameCommands = config.noFrameCommands !== undefined ? config.noFrameCommands : null;
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
  constructor(public settingsElement: EtSettingsTab) {
    super(settingsElement);
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

/**
 * Top level UI component for a normal terminal window
 *
 */
class ExtratermMainWebUI extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static init(): void {
    TabWidget.init();
    EtTerminal.init();
    EtSettingsTab.init();
    EtAboutTab.init();
    EtViewerTab.init();
    
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(ExtratermMainWebUI.TAG_NAME, {prototype: ExtratermMainWebUI.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME = 'extraterm-mainwebui';
  
  static EVENT_TAB_OPENED = 'tab-opened';
  
  static EVENT_TAB_CLOSED = 'tab-closed';
  
  static EVENT_TITLE = 'title';

  static EVENT_UNKNOWN_KEY_DOWN = "unknown-key-down";

  static POSITION_LEFT = TabPosition.LEFT;
  
  static POSITION_RIGHT = TabPosition.RIGHT;
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _tabInfo: TabInfo[];
  
  private _tabIdCounter: number;
  
  private _config: Config;

  private _split: boolean;
  
  private _initProperties(): void {
    this._log = new Logger("ExtratermMainWebUI");
    this._tabInfo = [];
    this._tabIdCounter = 0;
    this._config = null;
    this._split = false;
  }
  
  //-----------------------------------------------------------------------
  
  /**
   * Custom element API call back.
   */
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);
    
    
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

  destroy(): void {
  }
  
  focus(): void {
    // Put the focus onto the last terminal that had the focus.
    const lastFocus = this._tabInfo.filter( tabInfo => tabInfo.lastFocus );
    if (lastFocus.length !== 0) {
      lastFocus[0].focus();
    }
  }
  
  private _handleTabSwitch(tabWidget: TabWidget, position: TabPosition): void {
    const tabInfos = this._tabInfo.filter( tabInfo => tabInfo.position === position );
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
      `<div class="${TAB_HEADER_CONTAINER_CLASS}">` +
        `<div class="${TAB_HEADER_ICON_CLASS}"></div>` +
        `<div class="${TAB_HEADER_MIDDLE_CLASS}">${newId}</div>` +
        `<div class="${TAB_HEADER_CLOSE_CLASS}">` +
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
    tabInfo.contentDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
      if (ev.keyCode === 37 && ev.altKey) {
        // left-arrow
        this._shiftTab(tabInfo.position, -1);
    
      } else if (ev.keyCode === 39 && ev.altKey) {
        // right-arrow
        this._shiftTab(tabInfo.position, 1);
    
      } else if (ev.keyCode === 84 && ev.ctrlKey && ev.shiftKey) {
        // Ctrl+Shift+T - New tab.
        this.focusTab(this.newTerminalTab(tabInfo.position));
        
      } else if (ev.keyCode === 81 && ev.ctrlKey && ev.shiftKey) {
        // Ctrl+Shift+Q - Close tab.
        this.closeTab(tabInfo.id);

      } else if (ev.keyCode === 9 && ev.ctrlKey) {
        // Ctrl+Tab
        this.focusOtherPane();
      } else {
        return;
      }
      ev.stopPropagation();
    });
    
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
    
    let currentColumns = 80;
    let currentRows = 24;
    
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
      const tabInfo = new SettingsTabInfo(viewerElement);
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
    this._tabInfo.forEach( tabInfo => {
      tabInfo.resize();
    });
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

  private _frameFinder(frameId: string): string {
    for (let i=0; i<this._tabInfo.length; i++) {
      const text = this._tabInfo[i].getFrameContents(frameId);
      if (text !== null) {
        return text;
      }
    }
    return null;
  }

  //-----------------------------------------------------------------------
  // private _setConfigOnTerminal(terminal: EtTerminal, config: Config): void {
  //   terminal.blinkingCursor = config.blinkingCursor;
  //   terminal.themeCssPath = path.join(config.themePath, "theme.css").replace(/\\/g, "/");
  //   terminal.noFrameCommands = config.noFrameCommands !== undefined ? config.noFrameCommands : null;
  // }
    
  private _html(): string {
    return `
    <style>
    ${globalcss.topcoatCSS()}
    ${globalcss.fontAwesomeCSS()}
    
    #${ID_TOP} {
      position: absolute;
      top: 2px;
      bottom: 0;
      left: 0;
      right: 0;
      
      display: flex;
    }
    
    #${ID_PANE_LEFT} {
      flex: auto 1 1;  
    }
    
    #${ID_PANE_LEFT}, #${ID_PANE_RIGHT} {
      position: relative;
    }
    
    #${ID_TAB_CONTAINER_LEFT}, #${ID_TAB_CONTAINER_RIGHT} {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    
    #${ID_PANE_RIGHT} {
      display: none;
    }
    
    #${ID_TOP} > #gap {
      visibility: collapse;
      flex: 0px 0 0;
    }
    
    #${ID_TOP}.${CLASS_SPLIT} > #gap {
      visibility: visible;
      flex: 2px 0 0;
    }
    
    #${ID_TOP}.${CLASS_SPLIT} > #${ID_PANE_RIGHT} {
      flex: auto 1 1;
      display: block;
    }
    
    #${ID_REST_DIV_PRIMARY} {
      display: flex;
    }

    #${ID_REST_DIV_PRIMARY} > DIV.space {
      flex-grow: 1;
    }
    
    DIV.tab_content {
      height: 100%;
      width: 100%;
    }
    
    DIV.tab_content > * {
      width: 100%;
      height: 100%;
    }
    
    et-terminal {
      height: 100%;
      width: 100%;
    }
    
    DIV.${TAB_HEADER_CONTAINER_CLASS} {
      display: flex;
      width: 100%;
    }
    
    DIV.${TAB_HEADER_ICON_CLASS} {
      flex: 0 0 auto;
    }
    
    DIV.${TAB_HEADER_MIDDLE_CLASS} {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    DIV.${TAB_HEADER_CLOSE_CLASS} {
      flex: 0 0 auto;
      align-self: center;
    }
    
    DIV.${TAB_HEADER_CLOSE_CLASS} > BUTTON {
      border: 0px;
      padding: 0px;
      display: inline-block;
      width: 13px;
      height: 13px;
      margin: 2px;
      background-color: transparent;
      border-radius: 2px;
      margin-top: 3px;
    }
    
    DIV.${TAB_HEADER_CLOSE_CLASS} > BUTTON > I {
      position: relative;
      top: -1px;
    }    
    
    DIV.${TAB_HEADER_CLOSE_CLASS}:hover > BUTTON {
      background-color: #ff5454;
      color: #ffffff;
    }
    
    </style>
    <div id="${ID_TOP}">` +
        `<div id="${ID_PANE_LEFT}">` +
          `<cb-tabwidget id="${ID_TAB_CONTAINER_LEFT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_PRIMARY}"><button class="topcoat-icon-button--large--quiet" id="${ID_NEW_TAB_BUTTON_PRIMARY}"><i class="fa fa-plus"></i></button>` +
            `<content></content></div>` +
          `</cb-tabwidget>` +
        `</div>` +
        `<div id="gap"></div>` +
        `<div id="${ID_PANE_RIGHT}">` +
          `<cb-tabwidget id="${ID_TAB_CONTAINER_RIGHT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_SECONDARY}"><button class="topcoat-icon-button--large--quiet" id="${ID_NEW_TAB_BUTTON_SECONDARY}"><i class="fa fa-plus"></i></button></div>` +
          `</cb-tabwidget>` +
        `</div>` +
      `</div>`;
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

  private _getById(id: string): HTMLElement {
    return <HTMLElement>domutils.getShadowRoot(this).querySelector('#'+id);
  }
}

export = ExtratermMainWebUI;
