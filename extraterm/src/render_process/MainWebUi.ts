/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BulkFileHandle, SessionConfiguration, CreateSessionOptions } from "@extraterm/extraterm-extension-api";
import { html, render } from "extraterm-lit-html";
import { CustomElement, Attribute, Observe } from "extraterm-web-component-decorators";
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";

import { AboutTab } from "./AboutTab";
import { BulkFileBroker } from "./bulk_file_handling/BulkFileBroker";
import * as config from "../Config";
import * as DisposableUtils from "../utils/DisposableUtils";
import * as DomUtils from "./DomUtils";
import { EmbeddedViewer } from "./viewers/EmbeddedViewer";
import { EmptyPaneMenu } from "./command/EmptyPaneMenu";
import { EVENT_DRAG_STARTED, EVENT_DRAG_ENDED } from "./GeneralEvents";
import { ElementMimeType, FrameMimeType } from "./InternalMimeTypes";
import { KeybindingsManager, injectKeybindingsManager } from "./keybindings/KeyBindingsManager";
import { SettingsTab } from "./settings/SettingsTab";
import { DroppedEventDetail as SnapDroppedEventDetail, DropLocation } from "./gui/SnapDropContainer";
import { SplitLayout } from "./SplitLayout";
import { SplitOrientation } from "./gui/Splitter";
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";
import { Tab } from "./gui/Tab";
import { TabWidget, DroppedEventDetail } from "./gui/TabWidget";
import { EtTerminal, EXTRATERM_COOKIE_ENV } from "./Terminal";
import * as ThemeTypes from "../theme/Theme";
import { ThemeableElementBase } from "./ThemeableElementBase";
import { ViewerElement } from "./viewers/ViewerElement";
import * as ViewerElementTypes from "./viewers/ViewerElementTypes";
import { EtViewerTab } from "./ViewerTab";
import { PtyIpcBridge } from "./PtyIpcBridge";
import { ExtensionManager, injectExtensionManager, ViewerTabDisplay } from "./extension/InternalTypes";
import { ConfigDatabase, SESSION_CONFIG, injectConfigDatabase } from "../Config";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import { NewTerminalContextArea } from "./NewTerminalContextArea";
import { CommandAndShortcut } from "./command/CommandPalette";
import { dispatchContextMenuRequest, ContextMenuType, ExtensionContextOverride } from "./command/CommandUtils";
import { TerminalVisualConfig, injectTerminalVisualConfig } from "./TerminalVisualConfig";
import { doLater } from "extraterm-later";
import { focusElement } from "./DomUtils";

const VisualState = ViewerElementTypes.VisualState;

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
@CustomElement("extraterm-mainwebui")
export class MainWebUi extends ThemeableElementBase implements ViewerTabDisplay {

  static TAG_NAME = "EXTRATERM-MAINWEBUI";
  static EVENT_TAB_OPENED = "mainwebui-tab-opened";
  static EVENT_TAB_CLOSED = "mainwebui-tab-closed";
  static EVENT_TITLE = "mainwebui-title";
  static EVENT_MINIMIZE_WINDOW_REQUEST = "mainwebui-minimize-window-request";
  static EVENT_MAXIMIZE_WINDOW_REQUEST = "mainwebui-maximize-window-request";
  static EVENT_CLOSE_WINDOW_REQUEST = "mainwebui-close-window-request";
  static EVENT_QUIT_APPLICATION_REQUEST = "mainwebui-quit-application-request";

  private _log: Logger;

  #ptyIpcBridge: PtyIpcBridge = null;
  #configManager: ConfigDatabase = null;
  #keybindingsManager: KeybindingsManager = null;
  #extensionManager: ExtensionManager = null;
  #themes: ThemeTypes.ThemeInfo[] = [];
  #terminalVisualConfig: TerminalVisualConfig = null;
  #lastFocus: Element = null;
  #splitLayout: SplitLayout = null;
  #fileBroker = new BulkFileBroker();

  constructor() {
    super();
    this.#splitLayout = new SplitLayout();
    this._log = getLogger("ExtratermMainWebUI", this);
    this._handleViewerElementFocus = this._handleViewerElementFocus.bind(this);
  }

  setDependencies(configManager: ConfigDatabase, keyBindingManager: KeybindingsManager,
      extensionManager: ExtensionManager): void {

    this.#configManager = configManager;
    this.#keybindingsManager = keyBindingManager;
    this.#extensionManager = extensionManager;
    this._registerCommands(extensionManager);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._setUpShadowDom();
    this._setUpSplitLayout();
    this._setupPtyIpc();
  }

  @Attribute windowId = "";

  @Observe("windowId")
  private _observeWindowId(target: string): void {
    this.#splitLayout.setWindowId(this.windowId);
  }

  focus(): void {
    if (this.#lastFocus != null) {
      this._focusTabContent(this.#lastFocus);
    } else {
      const allContentElements = this.#splitLayout.getAllTabContents();
      if (allContentElements.length !== 0) {
        this._focusTabContent(allContentElements[0]);
      }
    }
  }

  render(): void {
    this.#splitLayout.update();
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;

    const settingsTab = this._getSettingsTab();
    if (settingsTab != null) {
      settingsTab.setTerminalVisualConfig(terminalVisualConfig);
    }

    for (const el of this.#splitLayout.getAllTabContents()) {
      injectTerminalVisualConfig(el, terminalVisualConfig);
    }
  }

  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this.#themes = themes;
    const settingsTab = this._getSettingsTab();
    if (settingsTab != null) {
      settingsTab.setThemes(this.#themes);
    }
  }

  getTabCount(): number {
    return this.#splitLayout.getAllTabContents().filter( (el) => !(el instanceof EmptyPaneMenu)).length;
  }

  getSplitLayout(): SplitLayout {
    return this.#splitLayout;
  }

  closeAllTabs(): void {
    const elements = this.#splitLayout.getAllTabContents().filter( (el) => !(el instanceof EmptyPaneMenu));
    for (const element of elements) {
      this._disposeTab(element);
    }
  }

  private _setUpShadowDom(): void {
    this.attachShadow({ mode: "open", delegatesFocus: false });

    const handleMainContainerFocus = {
      handleEvent: this._handleMainContainerFocusCapture.bind(this),
      capture: true
    };

    render(html`${this._styleTag()}
      <div id=${ID_TOP_LAYOUT}>
        <div id=${ID_TITLE_BAR}>
          <div id=${ID_TITLE_BAR_SPACE}>
            <div id=${ID_TOP_RESIZE_BAR}></div>
            <div id=${ID_DRAG_BAR}></div>
          </div>
          ${this._showWindowControls()
            ? html`
              <button id=${ID_MINIMIZE_BUTTON} tabindex="-1" @click=${this._handleMinimizeClick.bind(this)}></button>
              <button id=${ID_MAXIMIZE_BUTTON} tabindex="-1" @click=${this._handleMaximizeClick.bind(this)}></button>
              <button id=${ID_CLOSE_BUTTON} tabindex="-1" @click=${this._handleCloseWindowClick.bind(this)}></button>`
            : null}
        </div>
        <div
          id=${ID_MAIN_CONTENTS}
          class=${CLASS_MAIN_NOT_DRAGGING}
          @focus=${handleMainContainerFocus}
          @click=${this._handleMainContainerClickEvent.bind(this)}
          @et-viewer-element_metadata-change=${this._handleViewerMetadataChanged.bind(this)}}
          @et-tab-widget_switch=${this._handleTabSwitchEvent.bind(this)}
          @et-tab-widget_dropped=${this._handleTabWidgetDroppedEvent.bind(this)}
          @et-snap-drop-container_dropped=${this._handleTabWidgetSnapDroppedEvent.bind(this)}
          @extraterm_drag-started=${this._handleDragStartedEvent.bind(this)}
          @extraterm_drag-ended=${this._handleDragEndedEvent.bind(this)}>
        </div>
      </div>`, this.shadowRoot);
    this.updateThemeCss();

    const mainContainer = DomUtils.getShadowId(this, ID_MAIN_CONTENTS);
    DomUtils.addCustomEventResender(mainContainer, EVENT_DRAG_STARTED, this);
    DomUtils.addCustomEventResender(mainContainer, EVENT_DRAG_ENDED, this);
  }

  private _handleMainContainerFocusCapture(ev: FocusEvent): void {
    this.#extensionManager.updateExtensionWindowStateFromEvent(ev);
  }

  private _handleMinimizeClick(): void {
    focusElement(this, this._log);
    this._sendWindowRequestEvent(MainWebUi.EVENT_MINIMIZE_WINDOW_REQUEST);
  };

  private _handleMaximizeClick(): void {
    focusElement(this, this._log);
    this._sendWindowRequestEvent(MainWebUi.EVENT_MAXIMIZE_WINDOW_REQUEST);
  };

  private _handleCloseWindowClick(): void {
    focusElement(this, this._log);
    this._commandCloseWindow();
  };

  private _handleViewerMetadataChanged(ev: CustomEvent): void {
    const target = ev.target;
    if (target instanceof ViewerElement) {
      this._updateTabTitle(target);
    }
  }

  private _handleTabWidgetDroppedEvent(ev: CustomEvent): void {
    const detail = <DroppedEventDetail> ev.detail;

    if (ElementMimeType.equals(detail.mimeType, this.windowId)) {
      this._handleElementDroppedEvent(detail.targetTabWidget, detail.tabIndex, detail.dropData);
    } else if (FrameMimeType.equals(detail.mimeType, this.windowId)) {
      this._handleFrameDroppedEvent(detail.targetTabWidget, detail.tabIndex, detail.dropData);
    }
  }

  private _handleElementDroppedEvent(targetTabWidget: TabWidget, tabIndex: number, dropData: string): void {
    if (ElementMimeType.tagNameFromData(dropData) === Tab.TAG_NAME) {
      const tabElement = <Tab> DomUtils.getShadowId(this, ElementMimeType.elementIdFromData(dropData));

      this.#splitLayout.moveTabToTabWidget(tabElement, targetTabWidget, tabIndex);
      this.#splitLayout.update();

      const tabContent = this.#splitLayout.getTabContentByTab(tabElement);
      targetTabWidget.selectedIndex = tabIndex;
      this._focusTabContent(tabContent);
    }
  }

  private _handleFrameDroppedEvent(targetTabWidget: TabWidget, tabIndex: number, dropData: string): void {
    for (const el of this.#splitLayout.getAllTabContents()) {
      if (el instanceof EtTerminal) {
        const embeddedViewer = el.getEmbeddedViewerByFrameId(dropData);
        if (embeddedViewer != null) {
          const viewerTab = this._popOutEmbeddedViewer(embeddedViewer, el);
          const tab = this.#splitLayout.getTabByTabContent(viewerTab);
          this.#splitLayout.moveTabToTabWidget(tab, targetTabWidget, tabIndex);
          this.#splitLayout.update();
          this.focusTab(viewerTab);
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
      if (ElementMimeType.equals(detail.mimeType, this.windowId)) {
        this._handleElementDroppedEvent(target, target.selectedIndex + 1, detail.dropData);
      } else if (FrameMimeType.equals(detail.mimeType, this.windowId)) {
        this._handleFrameDroppedEvent(target, target.selectedIndex + 1, detail.dropData);
      }
    }
  }

  private _handleTabWidgetSnapDroppedDirectionEvent(ev: CustomEvent, orientation: SplitOrientation,
                                                    splitBefore: boolean): void {
    const detail = <SnapDroppedEventDetail> ev.detail;
    const target = ev.target;
    if (target instanceof TabWidget) {

      const newTabWidget = splitBefore ? this.#splitLayout.splitBeforeTabWidget(target, orientation) : this.#splitLayout.splitAfterTabWidget(target, orientation);
      this.#splitLayout.update();

      if (ElementMimeType.equals(detail.mimeType, this.windowId)) {
        this._handleElementDroppedEvent(newTabWidget, 0, detail.dropData);
      } else if (FrameMimeType.equals(detail.mimeType, this.windowId)) {
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
      if (part instanceof HTMLButtonElement && part.classList.contains(CLASS_NEW_TAB_BUTTON)) {
        let el: HTMLElement = part;
        while (el != null && ! (el instanceof TabWidget)) {
          el = el.parentElement;
        }
        if (this.#configManager.getConfig(SESSION_CONFIG).length !== 0) {
          const sessionUuid = this.#configManager.getConfig(SESSION_CONFIG)[0].uuid;
          this.commandNewTerminal({sessionUuid});
        }
      }
    }
  }

  private _setUpSplitLayout(): void {
    this.#splitLayout.setRootContainer(DomUtils.getShadowId(this, ID_MAIN_CONTENTS));

    this.#splitLayout.setTabContainerFactory( (tabWidget: TabWidget, tab: Tab, tabContent: Element): Element => {
      const divContainer = document.createElement("DIV");
      divContainer.classList.add(CLASS_TAB_CONTENT);
      return divContainer;
    });

    this.#splitLayout.setRightSpaceDefaultElementFactory( (): Element => {
      const tempDiv = document.createElement("DIV");
      tempDiv.innerHTML = this._newTabRestAreaHtml();
      return tempDiv.children.item(0);
    });
    this.#splitLayout.setTopLeftElement(this._leftControls());
    this.#splitLayout.setTopRightElement(this._menuControls());

    this.#splitLayout.setEmptySplitElementFactory( (previousElement: Element): Element => {
      let emptyPaneMenu: EmptyPaneMenu = <EmptyPaneMenu> previousElement;
      if (emptyPaneMenu == null) {
        emptyPaneMenu = <EmptyPaneMenu> document.createElement(EmptyPaneMenu.TAG_NAME);
        emptyPaneMenu.addEventListener("selected", (ev: CustomEvent): void => {

          const windowState = this.#extensionManager.getExtensionWindowStateFromEvent(ev);
          emptyPaneMenu.setFilter("");
          for (const entry of entriesAndShortcuts) {
            if (entry.id === ev.detail.selected) {
              this.#extensionManager.executeCommandWithExtensionWindowState(windowState, entry.command);
            }
          }
        });
      }

      const entries = this.#extensionManager.queryCommands({
        emptyPaneMenu: true,
        categories: ["application", "window", "textEditing", "terminal", "terminalCursorMode", "viewer"],
        when: true
      });

      const termKeybindingsMapping = this.#keybindingsManager.getKeybindingsMapping();
      const entriesAndShortcuts = entries.map((entry): CommandAndShortcut => {
        const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        return { id: entry.command + "_" + entry.category, shortcut, markedupLabel: entry.title, score: 0, ...entry };
      });

      emptyPaneMenu.setEntries(entriesAndShortcuts);
      return emptyPaneMenu;
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

  private _showWindowControls(): boolean {
    const systemConfig = <config.SystemConfig> this.#configManager.getConfig(config.SYSTEM_CONFIG);
    return systemConfig.titleBarStyle === "theme" && process.platform !== "darwin";
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

  private _addTab(tabContentElement: HTMLElement, tabWidget: TabWidget=null): Tab {
    const isTerminal = tabContentElement instanceof EtTerminal;

    if (tabWidget == null) {
      tabWidget = this.#splitLayout.firstTabWidget();
    }

    const newTab = <Tab> document.createElement(Tab.TAG_NAME);
    newTab.tabIndex = -1;
    newTab.addEventListener("contextmenu", this._handleTabHeaderContextMenu.bind(this, tabContentElement), true);

    this._renderTabHtml(newTab, tabContentElement);

    this.#splitLayout.appendTab(tabWidget, newTab, tabContentElement);
    this.#splitLayout.update();

    if (isTerminal) {
      const extensionsDiv = <HTMLDivElement> newTab.querySelector(".tab_title_extensions");
      this._addTabTitleWidgets(extensionsDiv, <EtTerminal> tabContentElement);
    }

    return newTab;
  }

  private _renderTabHtml(tab: Tab, tabContentElement: Element): void {
    const isTerminal = tabContentElement instanceof EtTerminal;

    let title = "";
    let icon = null;
    let tag: string  = null;
    if (tabContentElement instanceof EtViewerTab) {
      title = tabContentElement.getMetadata().title;
      icon = tabContentElement.getMetadata().icon;
      if (tabContentElement.getTag() !== null) {
        tag = tabContentElement.getTag();
      }
    } else if (tabContentElement instanceof ViewerElement) {
      title = tabContentElement.getMetadata().title;
      icon = tabContentElement.getMetadata().icon;
    } else if ( ! isTerminal) {
      this._log.warn(`Unrecognized element type in _updateTabTitle(). ${tabContentElement}`);
    }

    const template = html`
      <div class=${CLASS_TAB_HEADER_CONTAINER}>
        ${isTerminal
          ? html`<div class="tab_title_extensions"></div>`
          : html`
            <div class=${CLASS_TAB_HEADER_ICON}>${icon != null ? html`<i class=${icon}></i>` : null}</div>
            <div class=${CLASS_TAB_HEADER_MIDDLE} title=${title}>${title}</div>
            <div class=${CLASS_TAB_HEADER_TAG}>${tag != null ? html`<i class="fa fa-tag"></i> ${tag}` : null}</div>`}
        <div class=${CLASS_TAB_HEADER_CLOSE}>
          <button @click=${this._disposeTab.bind(this, tabContentElement)} class="microtool danger">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>`;
    render(template, tab);
  }

  private _handleTabHeaderContextMenu(tabContentElement: Element, ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();

    const override: ExtensionContextOverride = {};
    if (tabContentElement instanceof EtTerminal) {
      override.activeTerminal = tabContentElement;
    }

    dispatchContextMenuRequest(this, ev.clientX, ev.clientY, ContextMenuType.TERMINAL_TAB, override);
  }

  private _addTabTitleWidgets(extensionsDiv: HTMLDivElement, terminal: EtTerminal): void {
    const widgets = this.#extensionManager.createNewTerminalTabTitleWidgets(terminal);
    for (const widget of widgets) {
      extensionsDiv.appendChild(widget);
    }
  }

  private _tabWidgetFromElement(el: Element): TabWidget {
    return this.#splitLayout.getTabWidgetByTabContent(el);
  }

  private _handleTabSwitchEvent(ev: CustomEvent): void {
    if (ev.target instanceof TabWidget) {
      const el = this.#splitLayout.getTabContentByTab(ev.target.getSelectedTab());
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

  private newTerminalTab(sessionConfiguration: SessionConfiguration, workingDirectory: string,
      tabWidget: TabWidget=null): EtTerminal {

    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    newTerminal.setWindowId(this.windowId);
    newTerminal.setBulkFileBroker(this.#fileBroker);
    config.injectConfigDatabase(newTerminal, this.#configManager);
    injectKeybindingsManager(newTerminal, this.#keybindingsManager);
    newTerminal.setExtensionManager(this.#extensionManager);
    newTerminal.setFrameFinder(this._frameFinder.bind(this));
    newTerminal.setTerminalVisualConfig(this.#terminalVisualConfig);
    newTerminal.setSessionConfiguration(sessionConfiguration);

    // Set the default name of the terminal tab to the session name.
    newTerminal.setTerminalTitle(sessionConfiguration.name);

    this._addTab(newTerminal, tabWidget);
    this._setUpNewTerminalEventHandlers(newTerminal);
    this._createPtyForTerminal(newTerminal, sessionConfiguration.uuid, workingDirectory);
    this._sendTabOpenedEvent();

    return newTerminal;
  }

  private _getSessionByUuid(sessionUuid: string): SessionConfiguration {
    const sessions = this.#configManager.getConfigCopy(SESSION_CONFIG);
    for (const session of sessions) {
      if (session.uuid === sessionUuid) {
        return session;
      }
    }
    return null;
  }

  private _getSessionByName(sessionName: string): SessionConfiguration {
    const sessions = this.#configManager.getConfigCopy(SESSION_CONFIG);
    for (const session of sessions) {
      if (session.name === sessionName) {
        return session;
      }
    }
    return null;
  }

  private _createPtyForTerminal(newTerminal: EtTerminal, sessionUuid: string, workingDirectory: string): void {
    const extraEnv = {
      [EXTRATERM_COOKIE_ENV]: newTerminal.getExtratermCookieValue(),
      "COLORTERM": "truecolor",   // Advertise that we support 24bit color
    };

    const sessionOptions: CreateSessionOptions = {
      extraEnv,
      cols: newTerminal.getColumns(),
      rows: newTerminal.getRows()
    };

    if (workingDirectory != null) {
      sessionOptions.workingDirectory = workingDirectory;
    }

    const pty = this.#ptyIpcBridge.createPtyForTerminal(sessionUuid, sessionOptions);
    pty.onExit(() => {
      this._disposeTab(newTerminal);
    });
    newTerminal.setPty(pty);
  }

  private _setUpNewTerminalEventHandlers(newTerminal: EtTerminal): void {
    newTerminal.addEventListener("focus", (ev: FocusEvent) => {
      this.#lastFocus = newTerminal;
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
    const viewerTab = this._openEmbeddedViewerInTab(embeddedViewer, terminal.getFontAdjust());
    this.focusTab(viewerTab);
    terminal.deleteEmbeddedViewer(embeddedViewer);
    return viewerTab;
  }

  private _openEmbeddedViewerInTab(embeddedViewer: EmbeddedViewer, fontAdjust: number): EtViewerTab {
    const viewerElement = embeddedViewer.getViewerElement();
    const viewerTab = <EtViewerTab> document.createElement(EtViewerTab.TAG_NAME);
    viewerTab.setFontAdjust(fontAdjust);
    injectKeybindingsManager(viewerTab, this.#keybindingsManager);
    injectConfigDatabase(viewerTab, this.#configManager);
    viewerTab.setTitle(embeddedViewer.getMetadata().title);
    viewerTab.setTag(embeddedViewer.getTag());

    viewerElement.setMode(ViewerElementTypes.Mode.CURSOR);
    viewerElement.setVisualState(VisualState.AUTO);
    this.openViewerTab(viewerTab);
    viewerTab.setViewerElement(viewerElement);

    return viewerTab;
  }

  openViewerTab(viewerElement: ViewerElement, tabWidget: TabWidget=null): void {
    viewerElement.setFocusable(true);
    this._addTab(viewerElement, tabWidget);

    viewerElement.addEventListener("focus", this._handleViewerElementFocus);
    this._sendTabOpenedEvent();
  }

  private _handleViewerElementFocus(ev: FocusEvent): void {
    this.#lastFocus = <Element> ev.target;
  }

  closeViewerTab(viewerElement: ViewerElement): void {
    this.closeTab(viewerElement);
  }

  switchToTab(viewerElement: ViewerElement): void {
    this.focusTab(viewerElement);
  }

  private _updateTabTitle(el: HTMLElement): void {
    if (el instanceof EtTerminal) {
      return;
    }
    const tab = this.#splitLayout.getTabByTabContent(el);
    this._renderTabHtml(tab, el);
  }

  private _getSettingsTab(): SettingsTab {
    const settingsTabs = this.#splitLayout.getAllTabContents().filter(el => el instanceof SettingsTab);
    if (settingsTabs.length !== 0) {
      return <SettingsTab> settingsTabs[0];
    } else {
      return null;
    }
  }

  commandOpenSettingsTab(tabName: string=null): void {
    const settingsTab = this._getSettingsTab();
    if (settingsTab != null) {
      this.focusTab(settingsTab);
    } else {
      const settingsTabElement = <SettingsTab> document.createElement(SettingsTab.TAG_NAME);
      config.injectConfigDatabase(settingsTabElement, this.#configManager);
      injectKeybindingsManager(settingsTabElement, this.#keybindingsManager);
      injectExtensionManager(settingsTabElement, this.#extensionManager);
      settingsTabElement.setTerminalVisualConfig(this.#terminalVisualConfig);

      settingsTabElement.setThemes(this.#themes);
      if (tabName != null) {
        settingsTabElement.setSelectedTab(tabName);
      }
      this.openViewerTab(settingsTabElement);
      this.focusTab(settingsTabElement);
    }
  }

  private _commandApplicationQuit(): void {
    this._sendWindowRequestEvent(MainWebUi.EVENT_QUIT_APPLICATION_REQUEST);
  }

  commandOpenAboutTab(): void {
    const aboutTabs = this.#splitLayout.getAllTabContents().filter( (el) => el instanceof AboutTab );
    if (aboutTabs.length !== 0) {
      this.focusTab(aboutTabs[0]);
    } else {
      const viewerElement = <AboutTab> document.createElement(AboutTab.TAG_NAME);
      config.injectConfigDatabase(viewerElement, this.#configManager);
      injectKeybindingsManager(viewerElement, this.#keybindingsManager);
      this.openViewerTab(viewerElement);
      this.focusTab(viewerElement);
    }
  }

  closeTab(tabContentElement: Element): void {
    const tabWidget = this.#splitLayout.getTabWidgetByTabContent(tabContentElement);
    const tabWidgetContents = this.#splitLayout.getTabContentsByTabWidget(tabWidget);

    this.#splitLayout.removeTabContent(tabContentElement);
    this.#splitLayout.update();

    const oldIndex = tabWidgetContents.indexOf(tabContentElement);
    if (tabWidgetContents.length >= 2) {
      this.focusTab(tabWidgetContents[oldIndex === 0 ? 1 : oldIndex-1]);
    } else {
      const tabContents = this.#splitLayout.getTabContentsByTabWidget(tabWidget);
      if (tabContents.length !== 0) {
        this.focusTab(tabContents[0]);
      }
    }

    if (tabContentElement instanceof ViewerElement) {
      tabContentElement.didClose();
    }

    this._sendTabClosedEvent(tabContentElement);
  }

  private _disposeTab(tabContentElement: Element): void {
    this.closeTab(tabContentElement);

    if (tabContentElement instanceof EtTerminal) {
      const pty = tabContentElement.getPty();
      if (pty !== null) {
        pty.destroy();
      }
      const allTerminals = this._getAllTerminals().filter(t => t !== tabContentElement);
      this.#extensionManager.terminalDestroyed(tabContentElement, allTerminals);
    }

    if (DisposableUtils.isDisposable(tabContentElement)) {
      tabContentElement.dispose();
    }
  }

  focusTab(tabContentElement: Element): void {
    this.#splitLayout.showTabByTabContent(tabContentElement);
    this._focusTabContent(tabContentElement);

    // FIXME This is a work-around for the problem where new tabs can't get the focus immediately.
    if ( ! DomUtils.activeNestedElements().includes(tabContentElement)) {
      doLater(() => {
        this.#splitLayout.showTabByTabContent(tabContentElement);
        this._focusTabContent(tabContentElement);
      });
    }
  }

  private _selectAdjacentTab(tabWidget: TabWidget, direction: number): void {
    const contents = this.#splitLayout.getTabContentsByTabWidget(tabWidget);
    const len = contents.length;
    if (len === 0) {
      return;
    }

    let i = tabWidget.selectedIndex;
    i = i + direction;
    if (i < 0) {
      i = len - 1;
    } else if (i >= len) {
      i = 0;
    }
    tabWidget.selectedIndex = i;
    this._focusTabContent(contents[i]);
  }

  private _focusPaneLeft(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this.#splitLayout.getTabWidgetToLeft);
  }

  private _focusPaneRight(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this.#splitLayout.getTabWidgetToRight);
  }

  private _focusPaneAbove(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this.#splitLayout.getTabWidgetAbove);
  }

  private _focusPaneBelow(tabElement: Element): { tabWidget: TabWidget, tabContent: Element} {
    return this._focusPaneInDirection(tabElement, this.#splitLayout.getTabWidgetBelow);
  }

  private _focusPaneInDirection(tabElement: Element, directionFunc: (tabWidget: TabWidget) => TabWidget):
      { tabWidget: TabWidget, tabContent: Element} {

    const currentTabWidget = this.#splitLayout.getTabWidgetByTabContent(tabElement);
    const targetTabWidget = directionFunc.call(this.#splitLayout, currentTabWidget);
    if (targetTabWidget != null) {
      focusElement(targetTabWidget, this._log);
      const content = this.#splitLayout.getTabContentByTab(targetTabWidget.getSelectedTab());
      if (elementSupportsFocus(content)) {
        focusElement(content, this._log);
        return { tabWidget: targetTabWidget, tabContent: content };
      }
      return { tabWidget: targetTabWidget, tabContent: null };
    }
    return { tabWidget: null, tabContent: null };
  }

  private _moveTabElementToPaneLeft(tabElement: Element): void {
    this._moveTabElementToPaneInDirection(tabElement, this.#splitLayout.getTabWidgetToLeft);
  }

  private _moveTabElementToPaneRight(tabElement: Element): void {
    this._moveTabElementToPaneInDirection(tabElement, this.#splitLayout.getTabWidgetToRight);
  }

  private _moveTabElementToPaneUp(tabElement: Element): void {
    this._moveTabElementToPaneInDirection(tabElement, this.#splitLayout.getTabWidgetAbove);
  }

  private _moveTabElementToPaneDown(tabElement: Element): void {
    this._moveTabElementToPaneInDirection(tabElement, this.#splitLayout.getTabWidgetBelow);
  }

  private _moveTabElementToPaneInDirection(tabElement: Element,
      directionFunc: (tabWidget: TabWidget) => TabWidget): void {

    const currentTabWidget = this.#splitLayout.getTabWidgetByTabContent(tabElement);
    const targetTabWidget = directionFunc.call(this.#splitLayout, currentTabWidget);
    if (targetTabWidget != null) {
      this.#splitLayout.moveTabToTabWidget(this.#splitLayout.getTabByTabContent(tabElement), targetTabWidget, 0);
      this.#splitLayout.update();
      focusElement(targetTabWidget, this._log);
      if (elementSupportsFocus(tabElement)) {
        focusElement(tabElement, this._log);
      }
    }
  }

  private _getTabElementWithFocus(): Element {
    for (const el of this.#splitLayout.getAllTabContents()) {
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
      focusElement(el, this._log);
    } else if (elementSupportsFocus(el)) {
      focusElement(el, this._log);
    }
  }

  private _horizontalSplit(tabContentElement: Element): void {
    this._split(tabContentElement, SplitOrientation.HORIZONTAL);
  }

  private _verticalSplit(tabContentElement: Element): void {
    this._split(tabContentElement, SplitOrientation.VERTICAL);
  }

  private _split(tabContentElement: Element, orientation: SplitOrientation): void {
    const newTabWidget = this.#splitLayout.splitAfterTabContent(tabContentElement, orientation);
    this.#splitLayout.update();
    if (newTabWidget != null) {
      const element = this.#splitLayout.getEmptyContentByTabWidget(newTabWidget);
      if (element != null) {
        if (element instanceof EmptyPaneMenu) {
          // I can't figure out why a focusElement() doesn't work immediately.
          // It does work later though.
          doLater(() => {
            focusElement(element, this._log);
          });
        }
      } else {
        const tabWidget = this.#splitLayout.getTabWidgetByTabContent(tabContentElement);
        focusElement(tabWidget, this._log);
        if (elementSupportsFocus(tabContentElement)) {
          focusElement(tabContentElement, this._log);
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

    this.#splitLayout.closeSplitAtTabContent(tabContentElement);
    this.#splitLayout.update();

    if (focusInfo == null) {
      const tabWidget = this.#splitLayout.getTabWidgetByTabContent(tabContentElement);
      focusInfo = {tabWidget, tabContent: tabContentElement};
    }

    if (focusInfo.tabWidget != null) {
      focusElement(focusInfo.tabWidget, this._log);
      if (focusInfo.tabContent != null) {
        if (elementSupportsFocus(focusInfo.tabContent)) {
          focusElement(focusInfo.tabContent, this._log);
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

  private _sendTabClosedEvent(tabContentElement: Element): void {
    const event = new CustomEvent(MainWebUi.EVENT_TAB_CLOSED, { detail: { tabContentElement } });
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
    for (const el of this.#splitLayout.getAllTabContents()) {
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
    commands.registerCommand("extraterm:application.quit", (args: any) => this._commandApplicationQuit());
    commands.registerCommand("extraterm:window.closePane", (args: any) => this._commandClosePane());
    commands.registerCommand("extraterm:window.closeTab", (args: any) => this._commandCloseTab());
    commands.registerCommand("extraterm:window.closeWindow", (args: any) => this._commandCloseWindow());
    commands.registerCommand("extraterm:window.focusPaneAbove", (args: any) => this._commandFocusPaneAbove());
    commands.registerCommand("extraterm:window.focusPaneBelow", (args: any) => this._commandFocusPaneBelow());
    commands.registerCommand("extraterm:window.focusPaneLeft", (args: any) => this._commandFocusPaneLeft());
    commands.registerCommand("extraterm:window.focusPaneRight", (args: any) => this._commandFocusPaneRight());
    commands.registerCommand("extraterm:window.focusTabLeft", (args: any) => this._commandFocusTabLeft());
    commands.registerCommand("extraterm:window.focusTabRight", (args: any) => this._commandFocusTabRight());
    commands.registerCommand("extraterm:window.horizontalSplit", (args: any) => this._commandHorizontalSplit());
    commands.registerCommand("extraterm:window.moveTabToPaneDown", (args: any) => this._commandMoveTabToPaneDown());
    commands.registerCommand("extraterm:window.moveTabToPaneLeft", (args: any) => this._commandMoveTabToPaneLeft());
    commands.registerCommand("extraterm:window.moveTabToPaneRight", (args: any) => this._commandMoveTabToPaneRight());
    commands.registerCommand("extraterm:window.moveTabToPaneUp", (args: any) => this._commandMoveTabToPaneUp());
    commands.registerCommand("extraterm:window.newTerminal", (args: any) => this.commandNewTerminal(args));
    commands.registerCommand("extraterm:window.openAbout", (args: any) => this.commandOpenAboutTab());
    commands.registerCommand("extraterm:window.openSettings", (args: any) => this.commandOpenSettingsTab());
    commands.registerCommand("extraterm:window.verticalSplit", (args: any) => this._commandVerticalSplit());
  }

  private _getActiveTabElement(): HTMLElement {
    return this.#extensionManager.getActiveTab();
  }

  private _getActiveTabWidget(): TabWidget {
    return this.#extensionManager.getActiveTabWidget();
  }

  async commandNewTerminal(args: {sessionUuid?: string, sessionName?: string, workingDirectory?: string}):
      Promise<void> {

    let sessionConfiguration: SessionConfiguration = this.#configManager.getConfig(SESSION_CONFIG)[0];
    if (args.sessionUuid != null) {
      sessionConfiguration = this._getSessionByUuid(args.sessionUuid);
      if (sessionConfiguration == null) {
        throw new Error(`Unable to find session with UUID ${args.sessionUuid}`);
      }
    } else if (args.sessionName != null) {
      sessionConfiguration = this._getSessionByName(args.sessionName);
      if (sessionConfiguration == null) {
        throw new Error(`Unable to find session with name ${args.sessionName}`);
      }
    }

    let workingDirectory: string = null;
    if (args.workingDirectory != null) {
      workingDirectory = args.workingDirectory;
    } else {
      const activeTerminal = this.#extensionManager.getActiveTerminal();
      if (activeTerminal != null && activeTerminal.getSessionConfiguration().type === sessionConfiguration.type) {
        workingDirectory = await activeTerminal.getPty().getWorkingDirectory();
      }
    }

    const newTerminal = this.newTerminalTab(sessionConfiguration, workingDirectory, this._getActiveTabWidget());
    this.focusTab(newTerminal);
    this.#extensionManager.newTerminalCreated(newTerminal, this._getAllTerminals());
  }

  private _getAllTerminals(): EtTerminal[] {
    return <EtTerminal[]> this.#splitLayout.getAllTabContents().filter(el => el instanceof EtTerminal);
  }

  private _commandFocusTabLeft(): void {
    this._selectAdjacentTab(this._tabWidgetFromElement(this._getActiveTabElement()), -1);
  }

  private _commandFocusTabRight(): void {
    this._selectAdjacentTab(this._tabWidgetFromElement(this._getActiveTabElement()), 1);
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
    this._disposeTab(this._getActiveTabElement());
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

  private _commandMoveTabToPaneLeft(): void {
    this._moveTabElementToPaneLeft(this._getActiveTabElement());
  }

  private _commandMoveTabToPaneRight(): void {
    this._moveTabElementToPaneRight(this._getActiveTabElement());
  }

  private _commandMoveTabToPaneUp(): void {
    this._moveTabElementToPaneUp(this._getActiveTabElement());
  }

  private _commandMoveTabToPaneDown(): void {
    this._moveTabElementToPaneDown(this._getActiveTabElement());
  }

  private _commandCloseWindow(): void {
    this._sendWindowRequestEvent(MainWebUi.EVENT_CLOSE_WINDOW_REQUEST);
  }

  private _setupPtyIpc(): void {
    this.#ptyIpcBridge = new PtyIpcBridge();
  }
}

interface Focusable {
  focus(options?: { preventScroll: boolean }): void;
  hasFocus(): boolean;
}

function elementSupportsFocus(content: Element | Focusable): content is Focusable & HTMLElement {
  return content instanceof EtTerminal ||
          content instanceof EmptyPaneMenu ||
          content instanceof EtViewerTab ||
          content instanceof SettingsTab;
}
