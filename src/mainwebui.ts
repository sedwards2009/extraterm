/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import TabWidget = require('./gui/tabwidget');
import resourceLoader = require('./resourceloader');
import EtTerminal = require('./terminal');
import EtEmbeddedViewer = require('./embeddedviewer');
import CbTab = require('./gui/tab');
import webipc = require('./webipc');
import Messages = require('./windowmessages');
import path = require('path');
import _ = require('lodash');
import config = require('./config');
import globalcss = require('./gui/globalcss');

type Config = config.Config;
type SessionProfile = config.SessionProfile;

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
  constructor(public id: number, public position: TabPosition, public contentDiv: HTMLDivElement, public cbTab: CbTab) {
  }

  title(): string {
    return "";
  }
  
  focus(): void { }
  
  hasFocus(): boolean {
    return false;
  }
  
  destroy(): void { }
  
  copyToClipboard(): void { }
  
  pasteText(text: string ): void { }
}

/**
 * A tab which contains a terminal.
 */
class TerminalTabInfo extends TabInfo {
  
  constructor(public id: number, public position: TabPosition, public contentDiv: HTMLDivElement, public cbTab: CbTab,
    public terminal: EtTerminal, public ptyId: number) {
      
    super(id, position, contentDiv, cbTab);
  }
  
  title(): string {
    return this.terminal.terminalTitle;
  }
  
  focus(): void {
    this.terminal.resizeToContainer();
    this.terminal.focus();
  }
  
  hasFocus(): boolean {
    return this.terminal.hasFocus();
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
  
}

let terminalIdCounter = 1;

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
  
  static POSITION_LEFT = TabPosition.LEFT;
  
  static POSITION_RIGHT = TabPosition.RIGHT;
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _terminalTabs: TabInfo[];
  
  private _config: Config;

  private _defaultSessionProfile: SessionProfile;
  
  private _split: boolean;
  
  private _initProperties(): void {
    this._terminalTabs = [];
    this._config = null;
    this._defaultSessionProfile = null;
    this._split = false;
  }
  
  //-----------------------------------------------------------------------
  
  /**
   * Custom element API call back.
   */
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    const shadow = util.createShadowRoot(this);
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
      this.focusTerminalTab(this.newTerminalTab(this._split ? TabPosition.RIGHT : TabPosition.LEFT));
    });
    
    const newTabSecondaryButton = this._getById(ID_NEW_TAB_BUTTON_SECONDARY);
    newTabSecondaryButton.addEventListener('click', () => {
      this.focusTerminalTab(this.newTerminalTab(this._split ? TabPosition.LEFT : TabPosition.RIGHT));
    });
    
    this._setupIpc();
  }

  destroy(): void {
  }
  
  _handleTabSwitch(tabWidget: TabWidget, position: TabPosition): void {
    const tabInfos = this._terminalTabs.filter( tabInfo => tabInfo.position === position );
    if (tabWidget.currentIndex >= 0 && tabWidget.currentIndex < tabInfos.length) {
      const tabInfo = tabInfos[tabWidget.currentIndex];
      
      this._sendTitleEvent(tabInfo.title());
      tabInfo.focus();
    }
  }
  
  set config(config: Config) {
    this._config = config;
    this._terminalTabs.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo) {
        this._setConfigOnTerminal( (<TerminalTabInfo> tabInfo).terminal, config);
      }
    });    
  }
  
  get tabCount(): number {
    return this._terminalTabs.length;
  }
  
  set split(split: boolean) {
    if (split === this._split) {
      return;
    }
    
    const top = this._getById(ID_TOP);
    const tabContainerLeft = this._getById(ID_TAB_CONTAINER_LEFT);
    const tabContainerRight = this._getById(ID_TAB_CONTAINER_RIGHT);
    const restDivPrimary = this._getById(ID_REST_DIV_PRIMARY);
    const restDivSecondary = this._getById(ID_REST_DIV_SECONDARY);
    if (split) {
      // Split it in two.
      top.classList.add(CLASS_SPLIT);
      // The primary controls have the burger menu. When it is split, the controls are moved to the right side.
      tabContainerRight.appendChild(restDivPrimary);
      tabContainerLeft.appendChild(restDivSecondary);
      
    } else {
      // Go from a spliit with two panes to just one pane.
      top.classList.remove(CLASS_SPLIT);
      tabContainerLeft.appendChild(restDivPrimary);
      tabContainerRight.appendChild(restDivSecondary);
      
      // Move the terminal tabs from the right tab container to the left one.
      const nodesToMove = util.nodeListToArray(tabContainerRight.childNodes)
        .filter( node => ! (node.nodeName === "DIV" && ( (<HTMLDivElement>node).id === ID_REST_DIV_PRIMARY ||
          (<HTMLDivElement>node).id === ID_REST_DIV_SECONDARY)));
      nodesToMove.forEach( node => {
        tabContainerLeft.insertBefore(node, restDivPrimary);
        });

      // Fix up the list of terminal info objects.
      this._terminalTabs = [...this._terminalTabs.filter( info => info.position == TabPosition.LEFT ),
        ...this._terminalTabs.filter( info => info.position == TabPosition.RIGHT).map( info => {info.position = TabPosition.LEFT; return info; })];
    }
    
    this._split = split;
  }
  
  get split(): boolean {
    return this._split;
  }
  
  set defaultSessionProfile(sessionProfile: SessionProfile) {
    this._defaultSessionProfile = sessionProfile;
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(position: TabPosition): number {
    const newId = terminalIdCounter;
    terminalIdCounter++;
    const newCbTab = <CbTab> document.createElement(CbTab.TAG_NAME);
    newCbTab.innerHTML = "" + newId;
    
    const newDiv = document.createElement('div');
    newDiv.classList.add('terminal_holder');
    
    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    
    newDiv.appendChild(newTerminal);
    const tabInfo = new TerminalTabInfo(newId, position, newDiv, newCbTab, newTerminal, null);
    this._terminalTabs.push(tabInfo);
    
    const tabWidget = <TabWidget> this._getById(position === TabPosition.LEFT ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT);
    // The way the split view changes the position of the 'rest' controls in the tab widgets causes this expression below.
    const restDiv = this._getById(this._split === (position === TabPosition.LEFT) ? ID_REST_DIV_SECONDARY : ID_REST_DIV_PRIMARY);
    
    tabWidget.insertBefore(newCbTab, restDiv);
    tabWidget.insertBefore(newDiv, restDiv);
    
    // User input event
    newTerminal.addEventListener(EtTerminal.EVENT_USER_INPUT, (e) => {
      if (tabInfo.ptyId !== null) {
        webipc.ptyInput(tabInfo.ptyId, (<any> e).detail.data);
      }
    });
    
    // Terminal resize event
    newTerminal.addEventListener(EtTerminal.EVENT_TERMINAL_RESIZE, (e) => {
      if (tabInfo.ptyId !== null) {
        webipc.ptyResize(tabInfo.ptyId, (<any> e).detail.columns, (<any> e).detail.rows);
      }      
    });

    // Terminal title event
    newTerminal.addEventListener(EtTerminal.EVENT_TITLE, (e: CustomEvent) => {
      newCbTab.innerText = e.detail.title;
      this._sendTitleEvent(e.detail.title);
    });
    
    // Unknown key down event
    newTerminal.addEventListener(EtTerminal.EVENT_UNKNOWN_KEY_DOWN, (e: CustomEvent) => {
      const ev = <KeyboardEvent> e.detail;
      if (ev.keyCode === 37 && ev.shiftKey) {
        // left-arrow
        this._shiftTab(tabInfo.position, -1);
    
      } else if (ev.keyCode === 39 && ev.shiftKey) {
        // right-arrow
        this._shiftTab(tabInfo.position, 1);
    
      } else if (ev.keyCode === 84 && ev.shiftKey) {
        // Ctrl+Shift+T - New tab.
        this.focusTerminalTab(this.newTerminalTab(tabInfo.position));
        
      } else if (ev.keyCode === 87 && ev.shiftKey) {
        // Ctrl+Shift+W - Close tab.
        this.closeTerminalTab(tabInfo.id);

      } else if (ev.keyCode === 9 && ev.ctrlKey) {
        this.focusOtherPane();

      } else {
        console.log("Unknown key:",ev);
      }      
    });

    if (this._config !== null) {
      this._setConfigOnTerminal(newTerminal, this._config);
    }
    
    const newEnv = _.cloneDeep(process.env);
    const expandedExtra = config.expandEnvVariables(this._defaultSessionProfile,
      config.envContext(this._config.systemConfig)).extraEnv;

    let prop: string;
    for (prop in expandedExtra) {
      newEnv[prop] = expandedExtra[prop];
    }

    webipc.requestPtyCreate(this._defaultSessionProfile.command, this._defaultSessionProfile.arguments, 80, 24, newEnv).then(
      (msg: Messages.CreatedPtyMessage) => {
        tabInfo.ptyId = msg.id;
      }
    );
    
    this._sendTabOpenedEvent();
    return newId;
  }
  
  /**
   *
   */
  closeTerminalTab(terminalId: number): void {
    const matches = this._terminalTabs.filter( (p) => p.id === terminalId );
    if (matches.length === 0) {
      return;
    }
    const tabInfo = matches[0];
    const position = tabInfo.position;
    
    let paneTabInfos = this._terminalTabs.filter( tabInfo2 => tabInfo2.position === position );
    
    let index = paneTabInfos.indexOf(tabInfo);
    
    // Remove the tab from the list.
    this._terminalTabs = this._terminalTabs.filter( (p) => p.id !== terminalId );
    paneTabInfos = paneTabInfos.filter( tabInfo2 => tabInfo2.id !== terminalId );

    tabInfo.contentDiv.parentNode.removeChild(tabInfo.contentDiv);
    tabInfo.cbTab.parentNode.removeChild(tabInfo.cbTab);
    tabInfo.destroy();
    
    this._sendTabClosedEvent();
    
    paneTabInfos = this._terminalTabs.filter( tabInfo2 => tabInfo2.position === position );
    if (index >= paneTabInfos.length) {
      index--;
    }
    if (paneTabInfos.length !== 0) {
      this.focusTerminalTab(paneTabInfos[index].id);
    } else {
      this.focusPane(tabInfo.position === TabPosition.LEFT ? TabPosition.RIGHT : TabPosition.LEFT);
    }
  }
  
  focusTerminalTab(terminalId: number): void {
    let leftIndex = 0;
    let rightIndex = 0;
    for (let i=0; i<this._terminalTabs.length; i++) {
      const tabInfo = this._terminalTabs[i];
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
    
    const focussedTabInfos = this._terminalTabs.filter( tabInfo => tabInfo.hasFocus() );
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
    const tabsInfos = this._terminalTabs.filter( tabInfo => tabInfo.position === position);
    tabsInfos[tabContainer.currentIndex].focus(); // Give it the focus.
  }

  /**
   * Copys the selection in the focussed terminal to the clipboard.
   */
  copyToClipboard(): void {
    const termsWithFocus = this._terminalTabs.filter( tabInfo => tabInfo.hasFocus() );
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
    const termsWithFocus = this._terminalTabs.filter( tabInfo => tabInfo.hasFocus() );
    if (termsWithFocus.length === 0) {
      return;
    }
    termsWithFocus[0].pasteText(text);
  }
  
  //-----------------------------------------------------------------------
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

  //-----------------------------------------------------------------------
  private _setConfigOnTerminal(terminal: EtTerminal, config: Config): void {
    terminal.blinkingCursor = config.blinkingCursor;
    terminal.themeCssPath = path.join(config.themePath, "theme.css").replace(/\\/g, "/");
  }
    
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
    
    DIV.terminal_holder {
      height: 100%;
      width: 100%;
    }
    et-terminal {
      height: 100%;
      width: 100%;
    }
    </style>
    <div id="${ID_TOP}">` +
        `<div id="${ID_PANE_LEFT}">` +
          `<cb-tabwidget id="${ID_TAB_CONTAINER_LEFT}" show-frame="false">` +
            `<div id="${ID_REST_DIV_PRIMARY}"><button class="topcoat-icon-button--large--quiet" id="${ID_NEW_TAB_BUTTON_PRIMARY}"><i class="fa fa-plus"></i></button>` +
            `<content></content></div>` +
          `</cb-tabwidget>` +
        `</div>` +
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
    this._terminalTabs.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo && (<TerminalTabInfo>tabInfo).ptyId === msg.id) {
        tabInfo.terminal.write(msg.data);
      }
    });
  }
  
  private _handlePtyClose(msg: Messages.PtyClose): void {
    this._terminalTabs.forEach( (tabInfo) => {
      if (tabInfo instanceof TerminalTabInfo && (<TerminalTabInfo>tabInfo).ptyId === msg.id) {
        (<TerminalTabInfo>tabInfo).ptyId = null;
        this.closeTerminalTab(tabInfo.id);
      }
    });
  }
  
  //-----------------------------------------------------------------------
  
  private _shiftTab(position: TabPosition, direction: number): void {
    const shortTabList = this._terminalTabs.filter( tabInfo => tabInfo.position === position);
    const len = shortTabList.length;
    if (len === 0) {
      return;
    }
  
    const tabWidget = <TabWidget> this._getById(position === TabPosition.LEFT ? ID_TAB_CONTAINER_LEFT : ID_TAB_CONTAINER_RIGHT);
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
    return <HTMLElement>util.getShadowRoot(this).querySelector('#'+id);
  }
}

export = ExtratermMainWebUI;
