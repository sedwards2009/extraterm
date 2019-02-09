/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from 'he';
import { BulkFileHandle } from 'extraterm-extension-api';
import { WebComponent } from 'extraterm-web-component-decorators';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";

import { AboutTab } from './AboutTab';
import { BulkFileBroker } from './bulk_file_handling/BulkFileBroker';
import * as config from '../Config';
import * as DisposableUtils from '../utils/DisposableUtils';
import * as DomUtils from './DomUtils';
import { EmbeddedViewer } from './viewers/EmbeddedViewer';
import { EmptyPaneMenu } from './command/EmptyPaneMenu';
import { EVENT_DRAG_STARTED, EVENT_DRAG_ENDED } from './GeneralEvents';
import { ElementMimeType, FrameMimeType } from './InternalMimeTypes';
import { KeybindingsManager, AcceptsKeybindingsManager, injectKeybindingsManager } from './keybindings/KeyBindingsManager';
import { SettingsTab } from './settings/SettingsTab';
import { SnapDropContainer, DroppedEventDetail as SnapDroppedEventDetail, DropLocation } from './gui/SnapDropContainer';
import { SplitLayout } from './SplitLayout';
import { Splitter, SplitOrientation } from './gui/Splitter';
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";
import { Tab } from './gui/Tab';
import { TabWidget, DroppedEventDetail } from './gui/TabWidget';
import { EtTerminal, EXTRATERM_COOKIE_ENV } from './Terminal';
import * as ThemeTypes from '../theme/Theme';
import { ThemeableElementBase } from './ThemeableElementBase';
import { ViewerElement } from './viewers/ViewerElement';
import * as ViewerElementTypes from './viewers/ViewerElementTypes';
import { EtViewerTab } from './ViewerTab';
import { PtyIpcBridge } from './PtyIpcBridge';
import { ExtensionManager, injectExtensionManager } from './extension/InternalTypes';
import { ConfigDatabase, SESSION_CONFIG, injectConfigDatabase } from '../Config';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { NewTerminalContextArea } from './NewTerminalContextArea';
import { CommandAndShortcut } from './command/CommandPalette';

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
const ID_NEW_TERMINAL_CONTEXT_AREA = "ID_NEW_TERMINAL_CONTEXT_AREA";

const ID_REST_SLOT = "ID_REST_SLOT";
const ID_REST_DIV_LEFT = "ID_REST_DIV_LEFT";

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

/**
 * Top level UI component for a normal terminal window
 */
@WebComponent({tag: "extraterm-mainwebui"})
export class MainWebUi extends ThemeableElementBase implements AcceptsKeybindingsManager,
    config.AcceptsConfigDatabase {
  
  static TAG_NAME = "EXTRATERM-MAINWEBUI";
  static EVENT_TAB_OPENED = 'mainwebui-tab-opened';
  static EVENT_TAB_CLOSED = 'mainwebui-tab-closed';
  static EVENT_TITLE = 'mainwebui-title';
  static EVENT_MINIMIZE_WINDOW_REQUEST = "mainwebui-minimize-window-request";
  static EVENT_MAXIMIZE_WINDOW_REQUEST = "mainwebui-maximize-window-request";
  static EVENT_CLOSE_WINDOW_REQUEST = "mainwebui-close-window-request";

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;

  private _ptyIpcBridge: PtyIpcBridge = null;
  private _tabIdCounter = 0;
  private _configManager: ConfigDatabase = null;
  private _keybindingsManager: KeybindingsManager = null;
  private _extensionManager: ExtensionManager = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _lastFocus: Element = null;
  private _splitLayout = new SplitLayout();
  private _fileBroker = new BulkFileBroker();

  constructor() {
    super();
    this._log = getLogger("ExtratermMainWebUI", this);
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    this._setUpShadowDom();   
    this._setUpMainContainer();
    this._setUpSplitLayout();
    if (this._showWindowControls()) {
      this._setUpWindowControls();
    }
    this._setupPtyIpc();
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
  
  setConfigDatabase(configManager: ConfigDatabase): void {
    this._configManager = configManager;
  }
  
  setKeybindingsManager(keyBindingManager: KeybindingsManager): void {
    this._keybindingsManager = keyBindingManager;
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._extensionManager = extensionManager;
    this._registerCommands(extensionManager);
  }

  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._themes = themes;
    const settingsTab = this._getSettingsTab();
    if (settingsTab != null) {
      settingsTab.setThemes(this._themes);
    }
  }
  
  getTabCount(): number {
    return this._splitLayout.getAllTabContents().filter( (el) => !(el instanceof EmptyPaneMenu)).length;
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
        this._handleElementDroppedEvent(target, target.getSelectedIndex() + 1, detail.dropData);
      } else if (detail.mimeType === FrameMimeType.MIMETYPE) {
        this._handleFrameDroppedEvent(target, target.getSelectedIndex() + 1, detail.dropData);
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
    // This handler is intended to be triggered by the plus (new tab) button in the tab bar.
    for (const part of ev.path) {
      if (part instanceof HTMLButtonElement) {
        if (part.classList.contains(CLASS_NEW_TAB_BUTTON)) {
          let el: HTMLElement = part;
          while (el != null && ! (el instanceof TabWidget)) {
            el = el.parentElement;
          }
          if (this._configManager.getConfig(SESSION_CONFIG).length !== 0) {
            const  newTerminal = this.newTerminalTab(<TabWidget> el, this._configManager.getConfig(SESSION_CONFIG)[0].uuid);
            this._switchToTab(newTerminal);
          }
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

      const entries = this._extensionManager.queryCommands({
        emptyPaneMenu: true,
        categories: ["application", "window", "textEditing", "terminal", "terminalCursorMode", "viewer"],
        when: true
      });

      const termKeybindingsMapping = this._keybindingsManager.getKeybindingsMapping();
      const entriesAndShortcuts = entries.map((entry): CommandAndShortcut => {
        const shortcuts = termKeybindingsMapping.getKeyStrokesForCommandAndCategory(entry.command, entry.category);
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        return { id: entry.command + "_" + entry.category, shortcut, ...entry };
      });

      emptyPaneMenu.setEntries(entriesAndShortcuts);
      emptyPaneMenu.addEventListener("selected", (ev: CustomEvent): void => {
        emptyPaneMenu.setFilter("");
        for (const entry of entriesAndShortcuts) {
          if (entry.id === ev.detail.selected) {
            this._extensionManager.executeCommand(entry.command);
          }
        }
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
    tempDiv.innerHTML = `<div id="${ID_REST_DIV_LEFT}"></div>`;
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

  private _showWindowControls(): boolean {
    const systemConfig = <config.SystemConfig> this._configManager.getConfig(config.SYSTEM_CONFIG);
    return systemConfig.titleBarStyle === "theme" && process.platform !== "darwin";
  }

  private _html(): string {
    let windowControls = "";
    if (this._showWindowControls()) {
      windowControls = this._windowControlsHtml();
    }
  
    return trimBetweenTags(`
      <style id="${ThemeableElementBase.ID_THEME}"></style>
      <div id="${ID_TOP_LAYOUT}">
        <div id="${ID_TITLE_BAR}">
          <div id="${ID_TITLE_BAR_SPACE}">
            <div id="${ID_TOP_RESIZE_BAR}"></div>
            <div id="${ID_DRAG_BAR}"></div>
          </div>
          ${windowControls}
        </div>
        <div id="${ID_MAIN_CONTENTS}">
        </div>
      </div>`);
  }

  private _windowControlsHtml(): string {
    return trimBetweenTags(
      `<button id="${ID_MINIMIZE_BUTTON}" tabindex="-1"></button>
      <button id="${ID_MAXIMIZE_BUTTON}" tabindex="-1"></button>
      <button id="${ID_CLOSE_BUTTON}" tabindex="-1"></button>`);
  }

  private _newTabRestAreaHtml(extraContents = ""): string {
    return trimBetweenTags(`
      <div class="${CLASS_NEW_BUTTON_CONTAINER}">
        <${NewTerminalContextArea.TAG_NAME} id="${ID_NEW_TERMINAL_CONTEXT_AREA}">
          <button class="microtool primary ${CLASS_NEW_TAB_BUTTON}"><i class="fa fa-plus"></i></button>
        </${NewTerminalContextArea.TAG_NAME}>
        <div class="${CLASS_SPACE}"></div>
        ${extraContents}
      </div>
      `);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.EXTRAICONS,
      ThemeTypes.CssFile.MAIN_UI];
  }

  private _addTab(tabWidget: TabWidget, tabContentElement: Element): Tab {
    const newId = this._tabIdCounter;
    this._tabIdCounter++;
    const newTab = <Tab> document.createElement(Tab.TAG_NAME);
    newTab.setAttribute('id', "tab_id_" + newId);
    newTab.tabIndex = -1;
    newTab.innerHTML = trimBetweenTags(`
      <div class="${CLASS_TAB_HEADER_CONTAINER}">
        <div class="${CLASS_TAB_HEADER_ICON}"></div>
        <div class="${CLASS_TAB_HEADER_MIDDLE}">${newId}</div>
        <div class="${CLASS_TAB_HEADER_TAG}"></div>
        <div class="${CLASS_TAB_HEADER_CLOSE}">
          <button id="close_tag_id_${newId}" class="microtool danger"><i class="fa fa-times"></i></button>
        </div>
      </div>`);

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
      } else if (el instanceof EtViewerTab || el instanceof ViewerElement) {
        title = el.getMetadata().title;
      }

      this._sendTitleEvent(title);
      this._focusTabContent(el);
    }
  }
  
  newTerminalTab(tabWidget: TabWidget, sessionUuid: string): EtTerminal {
    if (tabWidget == null) {
      tabWidget = this._splitLayout.firstTabWidget();
    }

    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    newTerminal.setBulkFileBroker(this._fileBroker);
    config.injectConfigDatabase(newTerminal, this._configManager);
    injectKeybindingsManager(newTerminal, this._keybindingsManager);
    newTerminal.setExtensionManager(this._extensionManager);
    newTerminal.setFrameFinder(this._frameFinder.bind(this));

    // Set the default name of the terminal tab to the session name.
    const sessions = this._configManager.getConfig(SESSION_CONFIG);
    for (const session of sessions) {
      if (session.uuid === sessionUuid) {
        newTerminal.setTerminalTitle(session.name);
        break;
      }
    }

    this._addTab(tabWidget, newTerminal);
    this._setUpNewTerminalEventHandlers(newTerminal);
    this._createPtyForTerminal(newTerminal, sessionUuid);
    this._updateTabTitle(newTerminal);
    this._sendTabOpenedEvent();

    return newTerminal;
  }

  private _createPtyForTerminal(newTerminal: EtTerminal, sessionUuid: string): void {
    const extraEnv = {
      [EXTRATERM_COOKIE_ENV]: newTerminal.getExtratermCookieValue()
    };
    const pty = this._ptyIpcBridge.createPtyForTerminal(sessionUuid, extraEnv, newTerminal.getColumns(),
      newTerminal.getRows());
    pty.onExit(() => {
      this.closeTab(newTerminal);
    });
    newTerminal.setPty(pty);
  }

  private _setUpNewTerminalEventHandlers(newTerminal: EtTerminal): void {
    newTerminal.addEventListener('focus', (ev: FocusEvent) => {
      this._lastFocus = newTerminal;
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
    injectKeybindingsManager(viewerTab, this._keybindingsManager);
    injectConfigDatabase(viewerTab, this._configManager);
    viewerTab.setTitle(embeddedViewer.getMetadata().title);
    viewerTab.setTag(embeddedViewer.getTag());
    
    viewerElement.setMode(ViewerElementTypes.Mode.CURSOR);
    viewerElement.setVisualState(VisualState.AUTO);
    this._openViewerTab(this._firstTabWidget(), viewerTab);
    viewerTab.setViewerElement(viewerElement);

    this._updateTabTitle(viewerTab);
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
      icon = "fa fa-keyboard";

    } else if (el instanceof EtViewerTab) {
      title = el.getMetadata().title;
      htmlTitle = he.escape(title);
      icon = el.getMetadata().icon;
      if (el.getTag() !== null) {
        tag = "<i class='fa fa-tag'></i> " + el.getTag();
      }

    } else if (el instanceof ViewerElement) {
      title = el.getMetadata().title;
      htmlTitle = he.escape(title);
      icon = el.getMetadata().icon;

    } else {
      this._log.warn(`Unrecognized element type in _updateTabTitle(). ${el}`);
    }

    const iconDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_ICON}`);
    iconDiv.innerHTML = icon !== null ? '<i class="' + icon + '"></i>' : "";
    
    const middleDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_MIDDLE}`);
    middleDiv.title = title;
    middleDiv.innerHTML = htmlTitle;

    const tabDiv = <HTMLDivElement> tab.querySelector(`DIV.${CLASS_TAB_HEADER_TAG}`);
    tabDiv.innerHTML = tag;
  }

  private _getSettingsTab(): SettingsTab {
    const settingsTabs = this._splitLayout.getAllTabContents().filter(el => el instanceof SettingsTab);
    if (settingsTabs.length !== 0) {
      return <SettingsTab> settingsTabs[0];
    } else {
      return null;
    }
  }

  commandOpenSettingsTab(tabName: string=null): void {
    const settingsTab = this._getSettingsTab();
    if (settingsTab != null) {
      this._switchToTab(settingsTab);
    } else {
      const settingsTabElement = <SettingsTab> document.createElement(SettingsTab.TAG_NAME);
      config.injectConfigDatabase(settingsTabElement, this._configManager);
      injectKeybindingsManager(settingsTabElement, this._keybindingsManager);
      injectExtensionManager(settingsTabElement, this._extensionManager);

      settingsTabElement.setThemes(this._themes);
      if (tabName != null) {
        settingsTabElement.setSelectedTab(tabName);
      }
      this._openViewerTab(this._firstTabWidget(), settingsTabElement);
      this._switchToTab(settingsTabElement);
    }
  }
  
  commandOpenAboutTab(): void {
    const aboutTabs = this._splitLayout.getAllTabContents().filter( (el) => el instanceof AboutTab );
    if (aboutTabs.length !== 0) {
      this._switchToTab(aboutTabs[0]);
    } else {
      const viewerElement = <AboutTab> document.createElement(AboutTab.TAG_NAME);
      config.injectConfigDatabase(viewerElement, this._configManager);
      injectKeybindingsManager(viewerElement, this._keybindingsManager);
      this._openViewerTab(this._firstTabWidget(), viewerElement);
      this._switchToTab(viewerElement);
    }
  }
  
  closeTab(tabContentElement: Element): void {
    const tabWidget = this._splitLayout.getTabWidgetByTabContent(tabContentElement);
    const tabWidgetContents = this._splitLayout.getTabContentsByTabWidget(tabWidget);

    this._splitLayout.removeTabContent(tabContentElement);
    this._splitLayout.update();

    if (tabContentElement instanceof EtTerminal) {
      const pty = tabContentElement.getPty();
      tabContentElement.destroy();
      if (pty !== null) {
        pty.destroy();
      }
    }
    
    if (DisposableUtils.isDisposable(tabContentElement)) {
      tabContentElement.dispose();
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

  private _focusPaneLeft(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this._splitLayout.getTabWidgetToLeft);
  }

  private _focusPaneRight(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this._splitLayout.getTabWidgetToRight);
  }

  private _focusPaneAbove(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this._splitLayout.getTabWidgetAbove);
  }

  private _focusPaneBelow(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this._splitLayout.getTabWidgetBelow);
  }

  private _focusPaneInDirection(tabElement: Element, directionFunc: (tabWidget: TabWidget) => TabWidget):
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

  private _closeSplit(tabContentElement: Element): void {
    let focusInfo: {tabWidget: TabWidget, tabContent: Element} = null;
    if (tabContentElement instanceof EmptyPaneMenu) {
      focusInfo = this._focusPaneLeft(tabContentElement);
      if (focusInfo.tabWidget == null) {
        focusInfo = this._focusPaneRight(tabContentElement);
        if (focusInfo.tabWidget == null) {
          focusInfo = this._focusPaneAbove(tabContentElement);
          if (focusInfo.tabWidget == null) {
            focusInfo = this._focusPaneBelow(tabContentElement);
          }
        }
      }
    }

    this._splitLayout.closeSplitAtTabContent(tabContentElement);
    this._splitLayout.update();

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
    if (elWithFocus != null && SupportsClipboardPaste.isSupportsClipboardPaste(elWithFocus)) {
      elWithFocus.pasteText(text);
    }
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

  private _frameFinder(frameId: string): BulkFileHandle {
    for (const el of this._splitLayout.getAllTabContents()) {
      let bulkFileHandle: BulkFileHandle = null;
      if (el instanceof EtViewerTab && el.getTag() === frameId) {
        bulkFileHandle = el.getFrameContents(frameId);
      } else if (el instanceof EtTerminal) {
        bulkFileHandle = el.getFrameContents(frameId);
      }
      if (bulkFileHandle != null) {
        return bulkFileHandle;
      }
    }
    return null;
  }

  private _registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
    commands.registerCommand("extraterm:window.newTerminal", (args: any) => this._commandNewTerminal(args));
    commands.registerCommand("extraterm:window.focusTabLeft", (args: any) => this._commandFocusTabLeft());
    commands.registerCommand("extraterm:window.focusTabRight", (args: any) => this._commandFocusTabRight());
    commands.registerCommand("extraterm:window.focusPaneLeft", (args: any) => this._commandFocusPaneLeft());
    commands.registerCommand("extraterm:window.focusPaneRight", (args: any) => this._commandFocusPaneRight());
    commands.registerCommand("extraterm:window.focusPaneAbove", (args: any) => this._commandFocusPaneAbove());
    commands.registerCommand("extraterm:window.focusPaneBelow", (args: any) => this._commandFocusPaneBelow());
    commands.registerCommand("extraterm:window.closeTab", (args: any) => this._commandCloseTab());
    commands.registerCommand("extraterm:window.horizontalSplit", (args: any) => this._commandHorizontalSplit());
    commands.registerCommand("extraterm:window.verticalSplit", (args: any) => this._commandVerticalSplit());
    commands.registerCommand("extraterm:window.closePane", (args: any) => this._commandClosePane());
    commands.registerCommand("extraterm:window.moveTabLeft", (args: any) => this._commandMoveTabLeft());
    commands.registerCommand("extraterm:window.moveTabRight", (args: any) => this._commandMoveTabRight());
    commands.registerCommand("extraterm:window.moveTabUp", (args: any) => this._commandMoveTabUp());
    commands.registerCommand("extraterm:window.moveTabDown", (args: any) => this._commandMoveTabDown());
    commands.registerCommand("extraterm:window.openAbout", (args: any) => this.commandOpenAboutTab());
    commands.registerCommand("extraterm:window.openSettings", (args: any) => this.commandOpenSettingsTab());
  }

  private _getActiveTabElement(): HTMLElement {
    return this._extensionManager.getActiveTab();
  }

  private _commandNewTerminal(args: any): void {
    let sessionUuid = args.sessionUuid;
    if (sessionUuid == null) {
      sessionUuid = this._configManager.getConfig(SESSION_CONFIG)[0].uuid;
    }

    this._switchToTab(this.newTerminalTab(this._tabWidgetFromElement(this._getActiveTabElement()), sessionUuid));
  }

  private _commandFocusTabLeft(): void {
    this._shiftTab(this._tabWidgetFromElement(this._getActiveTabElement()), -1);
  }
    
  private _commandFocusTabRight(): void {
    this._shiftTab(this._tabWidgetFromElement(this._getActiveTabElement()), 1);
  }

  private _commandFocusPaneLeft(): void {
    this._focusPaneLeft(this._getActiveTabElement());
  }

  private _commandFocusPaneRight(): void {
    this._focusPaneRight(this._getActiveTabElement());
  }

  private _commandFocusPaneAbove(): void {
    this._focusPaneAbove(this._getActiveTabElement());
  }

  private _commandFocusPaneBelow(): void {
    this._focusPaneBelow(this._getActiveTabElement());
  }

  private _commandCloseTab(): void {
    this.closeTab(this._getActiveTabElement());
  }

  private _commandHorizontalSplit(): void {
    this._horizontalSplit(this._getActiveTabElement());
  }

  private _commandVerticalSplit(): void {
    this._verticalSplit(this._getActiveTabElement());
  }

  private _commandClosePane(): void {
    this._closeSplit(this._getActiveTabElement());
  }

  private _commandMoveTabLeft(): void {
    this._moveTabElementLeft(this._getActiveTabElement());
  }

  private _commandMoveTabRight(): void {
    this._moveTabElementRight(this._getActiveTabElement());
  }

  private _commandMoveTabUp(): void {
    this._moveTabElementUp(this._getActiveTabElement());
  }

  private _commandMoveTabDown(): void {
    this._moveTabElementDown(this._getActiveTabElement());
  }

  private _setupPtyIpc(): void {
    this._ptyIpcBridge = new PtyIpcBridge();
  }
}

interface Focusable {
  focus(): void;
  hasFocus(): boolean;
}

function elementSupportsFocus(content: Element | Focusable): content is Focusable {
  return content instanceof EtTerminal ||
          content instanceof EmptyPaneMenu ||
          content instanceof EtViewerTab ||
          content instanceof SettingsTab;
}
