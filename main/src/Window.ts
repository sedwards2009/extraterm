/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import { Logger, log, getLogger } from "extraterm-logging";
import { CDockAreaWidget, CDockManager, CDockWidget, CFloatingDockContainer, DockWidgetFeature, DockWidgetTabFeature,
  TitleBarButton } from "nodegui-plugin-qads";
import { FontSlice } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-timeoutqt";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction, FocusPolicy, QKeyEvent, WidgetAttribute,
  QPoint, QRect, QKeySequence, QWindow, QScreen, QApplication, ContextMenuPolicy, QBoxLayout, QLabel, TextFormat,
  QMouseEvent, MouseButton, Visibility, QIcon, QSize, WindowState, WidgetEventTypes } from "@nodegui/nodegui";
import { Disposable, TerminalTheme } from "@extraterm/extraterm-extension-api";
import { Menu, ToolButton, Label } from "qt-construct";
import { loadFile as loadFontFile} from "extraterm-font-ligatures";
import he from "he";
import { hasEmojiPresentation } from "extraterm-unicode-utilities";

import * as SourceDir from "./SourceDir.js";
import { FontInfo, GeneralConfig, GENERAL_CONFIG } from "./config/Config.js";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase.js";
import { Tab } from "./Tab.js";
import { Terminal } from "./terminal/Terminal.js";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig.js";
import { ThemeManager } from "./theme/ThemeManager.js";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { qKeyEventToMinimalKeyboardEvent } from "./keybindings/QKeyEventUtilities.js";
import { UiStyle } from "./ui/UiStyle.js";
import { CachingLigatureMarker, LigatureMarker } from "./CachingLigatureMarker.js";
import { DisposableHolder } from "./utils/DisposableUtils.js";
import { createHtmlIcon } from "./ui/Icons.js";
import { SettingsTab } from "./settings/SettingsTab.js";
import { ContextMenuEvent } from "./ContextMenuEvent.js";
import { DecoratedFrame } from "./terminal/DecoratedFrame.js";
import { TWEMOJI_FAMILY } from "./TwemojiConstants.js";
import { BlockFrame } from "./terminal/BlockFrame.js";
import { CommonExtensionWindowState } from "./extension/CommonExtensionState.js";


export function setupWindowManager(): void {

}


export interface PopOutClickedDetails {
  window: Window;
  frame: DecoratedFrame;
  terminal: Terminal;
}

const allWindows: Window[] = [];
const allTabs: TabPlumbing[] = [];

export function getAllWindows(): Window[] {
  return allWindows;
}

function getTabPlumbingForTab(tab: Tab): TabPlumbing {
  for (const tabPlumbing of allTabs) {
    if (tabPlumbing.tab === tab) {
      return tabPlumbing;
    }
  }
  return null;
}

function getTabPlumbingForDockWidget(dockWidget: CDockWidget): TabPlumbing {
  for (const tabPlumbing of allTabs) {
    if (tabPlumbing.dockWidget === dockWidget) {
      return tabPlumbing;
    }
  }
  return null;
}

function getWindowForTab(tab: Tab): Window {
  for (const win of allWindows) {
    if (win.hasTab(tab)) {
      return win;
    }
  }
  return null;
}


class TabPlumbing implements Disposable {
  private _log: Logger = null;

  tab: Tab = null;
  #disposableHolder = new DisposableHolder();
  titleLabel: QLabel = null;
  titleWidget: QWidget = null;
  dockWidget: CDockWidget = null;

  constructor(tab: Tab) {
    this._log = getLogger("TabPlumbing", this);
    this.tab = tab;

    const dockWidget = new CDockWidget(tab.getWindowTitle());
    dockWidget.setFeature(DockWidgetFeature.CustomCloseHandling, true);
    dockWidget.setWidget(tab.getContents());

    const tabWidget = dockWidget.tabWidget();
    tabWidget.setFeature(DockWidgetTabFeature.DockWidgetTabTitle, false);
    tabWidget.setFeature(DockWidgetTabFeature.DockWidgetTabContextMenu, false);

    this.dockWidget = dockWidget;

    if (tab instanceof Terminal) {
      this.#disposableHolder.add(tab.onContextMenu((ev: ContextMenuEvent) => {
        const window = getWindowForTab(tab);
        window.openContextMenu(ev.terminal, ev.blockFrame, ev.x, ev.y);
      }));

      this.#disposableHolder.add(tab.onPopOutClicked((details) => {
        const window = getWindowForTab(tab);
        window.tabPopOutClicked(details);
      }));
    }

    this.#disposableHolder.add(tab.onWindowTitleChanged((title: string) => {
      const window = getWindowForTab(tab);
      window.handleTabWindowTitleChanged(tab, title);
    }));

    dockWidget.addEventListener("closeRequested", () => {
      const window = getWindowForTab(tab);
      window.handleTabCloseClicked(tab);
    });

    this.#disposableHolder.add(tab.onWindowTitleChanged((title: string) => {
      this.dockWidget.setWindowTitle(title);
    }));

    tabWidget.addEventListener(WidgetEventTypes.MouseButtonPress, (nativeEvent) => {
      this._log.debug(`WidgetEventTypes.MouseButtonPress`);
      const ev = new QMouseEvent(nativeEvent);
      const window = getWindowForTab(tab);
      window.handleTabMouseButtonPress(tab, ev);
    });

    tab.getContents().addEventListener(WidgetEventTypes.FocusIn, (nativeEvent) => {
      this._log.debug(`WidgetEventTypes.FocusIn`);
    });
  }

  dispose(): void {
    this.dockWidget.closeDockWidget();
    this.#disposableHolder.dispose();
    allTabs.splice(allTabs.indexOf(this), 1);
  }
}

enum WindowOpenState {
  Closed,
  Open,
  Minimized,
  ClosedMinimized
}

let windowIdCounter = 0;

export function handleNewCDockAreaWidget(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager,
  uiStyle: UiStyle, dockAreaWidget: CDockAreaWidget): void {

  new DockAreaMenu(extensionManager, keybindingsIOManager, uiStyle, dockAreaWidget);
}

class DockAreaMenu {
  private _log: Logger = null;
  #dockAreaWidget: CDockAreaWidget = null;

  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #uiStyle: UiStyle = null;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager,
    uiStyle: UiStyle, dockAreaWidget: CDockAreaWidget) {

    this._log = getLogger("DockAreaMenu", this);

    this.#dockAreaWidget = dockAreaWidget;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;

    this.#init();
  }

  #init(): void {
    const menu = this.#createHamburgerMenu();
    const titleBar = this.#dockAreaWidget.titleBar();
    const index = titleBar.indexOf(titleBar.button(TitleBarButton.TitleBarButtonTabsMenu));
    titleBar.insertWidget(index + 1, menu);
  }

  #createHamburgerMenu(): QToolButton {
    const iconPair = this.#uiStyle.getToolbarButtonIconPair("fa-bars");

    this.#hamburgerMenuButton = ToolButton({
      icon: iconPair.normal,
      popupMode: ToolButtonPopupMode.InstantPopup,
      onEnter: () => {
        this.#hamburgerMenuButton.setIcon(iconPair.hover);
      },
      onLeave: () => {
        this.#hamburgerMenuButton.setIcon(iconPair.normal);
      },
      onMouseButtonPress: () => {
        this.#updateHamburgerMenu(this.#uiStyle);
      },
      menu: this.#hamburgerMenu = Menu({
        attribute: [WidgetAttribute.WA_TranslucentBackground],
        onTriggered: (nativeAction) => {
          const action = new QAction(nativeAction);
          this.#handleWindowMenuTriggered(action.data().toString());
        }
      })
    });

    this.#updateHamburgerMenu(this.#uiStyle);

    return this.#hamburgerMenuButton;
  }

  #updateHamburgerMenu(uiStyle: UiStyle): void {
    const options: CommandQueryOptions = {
      when: true,
      windowMenu: true,
    };
    this.#updateMenu(this.#hamburgerMenu, uiStyle, options);
  }

  #updateMenu(menu: QMenu, uiStyle: UiStyle, options: CommandQueryOptions, context?: CommonExtensionWindowState): void {
    menu.clear();

    if (context == null) {
      context = this.#extensionManager.copyExtensionWindowState();
    }
    const entries = this.#extensionManager.queryCommandsWithExtensionWindowState(options, context);
    if (entries.length === 0) {
      return;
    }

    const termKeybindingsMapping = this.#keybindingsIOManager.getCurrentKeybindingsMapping();
    let category = entries[0].category;
    for (const entry of entries) {
      if (entry.category !== category) {
        menu.addSeparator();
        category = entry.category;
      }

      const action = menu.addAction(entry.title);
      action.setData(new QVariant(entry.command));
      if (entry.icon != null && entry.icon !== "") {
        const icon = uiStyle.getMenuIcon(entry.icon);
        if (icon != null) {
          action.setIcon(icon);
        }
      }

      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
      if (shortcuts.length !== 0) {
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        action.setShortcut(new QKeySequence(shortcut));
      }
    }
  }

  #handleWindowMenuTriggered(commandName: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommand(commandName);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }
}


export function createWindow(dockManager: CDockManager): Window {
  const label = new QLabel();
  label.setText("Empty area");

  const emptyDockWidget = new CDockWidget("Extraterm");
  emptyDockWidget.setWidget(label);
  emptyDockWidget.setFeature(DockWidgetFeature.NoTab, true);

  const dockContainer = dockManager.addDockWidgetFloating(emptyDockWidget);
  // ^ This will hit `handleNewFloatingDockContainer()` below via an event.

  for (const win of getAllWindows()) {
    if (win.dockContainer === dockContainer) {
      return win;
    }
  }
  return null;
}

export function handleNewFloatingDockContainer(floatingDockContainer: CFloatingDockContainer,
    dockManager: CDockManager, configDatabase: ConfigDatabase,extensionManager: ExtensionManager,
    keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager, uiStyle: UiStyle): void {

  const newWindow = new Window(floatingDockContainer, dockManager, configDatabase, extensionManager,
    keybindingsIOManager, themeManager, uiStyle);
  allWindows.push(newWindow);
}

export class Window implements Disposable {
  private _log: Logger = null;
  #id = 0;
  #dockManager: CDockManager = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;

  #windowOpenState = WindowOpenState.Closed;
  dockContainer: CFloatingDockContainer = null;

  #windowHandle: QWindow = null;
  #screen: QScreen = null;
  #lastConfigDpi = -1;
  #lastConfigDpr = -1;

  #contextMenu: QMenu = null;

  #terminalVisualConfig: TerminalVisualConfig = null;
  #themeManager: ThemeManager = null;
  #uiStyle: UiStyle = null;

  onTabCloseRequest: Event<Tab> = null;
  #onTabCloseRequestEventEmitter = new EventEmitter<Tab>();

  onTabChange: Event<Tab> = null;
  #onTabChangeEventEmitter = new EventEmitter<Tab>();

  onWindowGeometryChanged: Event<void> = null;
  #onWindowGeometryChangedEventEmitter = new EventEmitter<void>();

  #onPopOutClickedEventEmitter = new EventEmitter<PopOutClickedDetails>();
  onPopOutClicked: Event<PopOutClickedDetails> = null;

  #onWindowCloseEventEmitter = new EventEmitter<Window>();
  onWindowClosed: Event<Window> = null;

  constructor(dockContainer: CFloatingDockContainer, dockManager: CDockManager, configDatabase: ConfigDatabase,
      extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager,
      uiStyle: UiStyle) {

    this._log = getLogger("Window", this);
    ++windowIdCounter;
    this.#id = windowIdCounter;
    this.#dockManager = dockManager;
    this.dockContainer = dockContainer;
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;

    this.#handleLogicalDpiChanged = this.#UnboundHandleLogicalDpiChanged.bind(this);

    this.onTabCloseRequest = this.#onTabCloseRequestEventEmitter.event;
    this.onTabChange = this.#onTabChangeEventEmitter.event;
    this.onWindowGeometryChanged = this.#onWindowGeometryChangedEventEmitter.event;
    this.onPopOutClicked = this.#onPopOutClickedEventEmitter.event;
    this.onWindowClosed = this.#onWindowCloseEventEmitter.event;
  }

  async init(geometry: QRect): Promise<void> {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    this.#configDatabase.onChange((event: ConfigChangeEvent) => this.#handleConfigChangeEvent(event));

    this.dockContainer.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });

    this.dockContainer.addEventListener(WidgetEventTypes.Close, () => {
      this.#windowOpenState = WindowOpenState.Closed;
      this.#onWindowCloseEventEmitter.fire(this);
    });
    this.dockContainer.setWindowIcon(this.#createWindowIcon());
    this.dockContainer.setMouseTracking(true);
    this.dockContainer.setContextMenuPolicy(ContextMenuPolicy.PreventContextMenu);
    this.dockContainer.setFocusPolicy(FocusPolicy.ClickFocus);

    // this.#windowWidget = Widget({
    //   windowTitle: "Extraterm Qt",
    //   focusPolicy: FocusPolicy.ClickFocus,
    //   contextMenuPolicy: ContextMenuPolicy.PreventContextMenu,
    //   cssClass: ["window-background"],
    //   onClose: () => {
    //     this.#windowOpenState = WindowOpenState.Closed;
    //     this.#onWindowCloseEventEmitter.fire(this);
    //   },
    //   onKeyPress: (nativeEvent) => {
    //     this.#handleKeyPress(new QKeyEvent(nativeEvent));
    //   },
    //   onMove: (nativeEvent) => {
    //     this.#onWindowGeometryChangedEventEmitter.fire();
    //   },
    //   onResize:(nativeEvent) => {
    //     this.#onWindowGeometryChangedEventEmitter.fire();
    //   },
    //   windowIcon: this.#createWindowIcon(),
    //   mouseTracking: true,

    if (geometry != null) {
      this.dockContainer.setGeometry(geometry.left(), geometry.top(), geometry.width(), geometry.height());
    } else {
      this.dockContainer.resize(800, 480);
    }

    // this.#loadStyleSheet(generalConfig.uiScalePercent/100);

    this.#initContextMenu();

    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
  }

  #loadStyleSheet(uiScale: number): void {
    this.dockContainer.setStyleSheet("", false);
    // this.#hamburgerMenu.setStyleSheet("", false);
    if (process.platform === "darwin") {
      uiScale *= 1.5; // Make everything bigger on macOS to more closely match native apps.
                      // Note: This factor appears in main.ts:#setApplicationStyle too.
    }
    const sheet = this.#uiStyle.getApplicationStyleSheet(uiScale, this.getDpi());
    this.dockContainer.setStyleSheet(sheet, false);
    // this.#hamburgerMenu.setStyleSheet(sheet, false);

    // this.#repolishTabBar();
  }

  #createWindowIcon(): QIcon {
    const windowIcon = new QIcon();
    for (const size of [16, 22, 32, 64, 256]) {
      const iconPath = path.join(SourceDir.path, `../resources/logo/extraterm_small_logo_${size}x${size}.png`);
      windowIcon.addFile(iconPath, new QSize(size, size));
    }
    return windowIcon;
  }

  // #updateHamburgerMenu(uiStyle: UiStyle): void {
  //   const options: CommandQueryOptions = {
  //     when: true,
  //     windowMenu: true,
  //   };
  //   this.#updateMenu(this.#hamburgerMenu, uiStyle, options);
  // }

  #updateMenu(menu: QMenu, uiStyle: UiStyle, options: CommandQueryOptions, context?: CommonExtensionWindowState): void {
    menu.clear();

    if (context == null) {
      context = this.#extensionManager.copyExtensionWindowState();
    }
    const entries = this.#extensionManager.queryCommandsWithExtensionWindowState(options, context);
    if (entries.length === 0) {
      return;
    }

    const termKeybindingsMapping = this.#keybindingsIOManager.getCurrentKeybindingsMapping();
    let category = entries[0].category;
    for (const entry of entries) {
      if (entry.category !== category) {
        menu.addSeparator();
        category = entry.category;
      }

      const action = menu.addAction(entry.title);
      action.setData(new QVariant(entry.command));
      if (entry.icon != null && entry.icon !== "") {
        const icon = uiStyle.getMenuIcon(entry.icon);
        if (icon != null) {
          action.setIcon(icon);
        }
      }

      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
      if (shortcuts.length !== 0) {
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        action.setShortcut(new QKeySequence(shortcut));
      }
    }
  }

  #initContextMenu(): void {
    this.#contextMenu = Menu({
      attribute: [WidgetAttribute.WA_TranslucentBackground],
      onTriggered: (nativeAction) => {
        const action = new QAction(nativeAction);
        this.#handleContextMenuTriggered(this.#contextMenuState, action.data().toString());
      },
      onClose: () => {
        doLater(() => {
          this.#contextMenuState = null;
        });
      }
    });
    this.#contextMenu.hide();
  }

  openContextMenu(terminal: Terminal, blockFrame: BlockFrame, x: number, y: number): void {
    const options: CommandQueryOptions = {
      when: true,
      contextMenu: true,
    };

    const state = this.#extensionManager.copyExtensionWindowState();
    state.activeTerminal = terminal;
    state.activeBlockFrame = blockFrame;
    this.#contextMenuState = state;
    this.#updateMenu(this.#contextMenu, this.#uiStyle, options, state);

    this.#contextMenu.popup(new QPoint(x, y));
  }

  #contextMenuState: CommonExtensionWindowState = null;

  #handleContextMenuTriggered(context: CommonExtensionWindowState, commandName: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommandWithExtensionWindowState(context, commandName);
        // ^ Let any Promise here run to completion by itself.
        this.#contextMenuState = null;
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  handleTabMouseButtonPress(tab: Tab, ev: QMouseEvent): void {
    const isContextMenu = ev.button() === MouseButton.RightButton;
    if (!isContextMenu) {
      return;
    }

    this.focusTab(tab);

    ev.accept();
    const options: CommandQueryOptions = {
      when: true,
      terminalTitleMenu: true,
    };
    this.#updateMenu(this.#contextMenu, this.#uiStyle, options);
    this.#contextMenu.popup(new QPoint(ev.globalX(), ev.globalY()));
  }

  handleTabCloseClicked(tab: Tab): void {
    this.#onTabCloseRequestEventEmitter.fire(tab);
  }

  #handleKeyPress(event: QKeyEvent): void {
    this._log.debug(`#handleKeyPress()`);
    const ev = qKeyEventToMinimalKeyboardEvent(event);
    const commands = this.#keybindingsIOManager.getCurrentKeybindingsMapping().mapEventToCommands(ev);
    const filteredCommands = this.#extensionManager.queryCommands({
      commands,
      when: true
    });
    if (filteredCommands.length !== 0) {
      if (filteredCommands.length !== 1) {
        this._log.warn(`Commands ${filteredCommands.map(fc => fc.command).join(", ")} have conflicting keybindings.`);
      }
      try {
        this.#extensionManager.executeCommand(filteredCommands[0].command);
      } catch(ex) {
        this._log.warn(ex);
      }
    }
  }

  async #createTerminalVisualConfig(): Promise<TerminalVisualConfig> {
    const config = this.#configDatabase.getGeneralConfig();
    const fontInfo = this.#getFontInfo(config.terminalFont);
    const terminalTheme = this.#themeManager.getTerminalTheme(config.themeTerminal);

    let ligatureMarker: LigatureMarker = null;
    if (config.terminalDisplayLigatures && fontInfo.path != null) {
      const plainLigatureMarker = await loadFontFile(fontInfo.path);
      if (plainLigatureMarker != null) {
        ligatureMarker = new CachingLigatureMarker(plainLigatureMarker);
      }
    }

    const transparentBackground = config.windowBackgroundMode !== "opaque";

    const extraFonts: FontSlice[] = [
      {
        fontFamily: TWEMOJI_FAMILY,
        fontSizePx: 16,
        containsCodePoint: hasEmojiPresentation,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ];

    this.#lastConfigDpi = this.getDpi();
    this.#lastConfigDpr = this.getDpr();

    const scaledFontSize = config.terminalFontSize * this.#lastConfigDpr;
    const terminalFontSizePx = Math.round(this.#pointsToPx(scaledFontSize, this.#lastConfigDpi));

    const terminalVisualConfig: TerminalVisualConfig = {
      cursorStyle: config.cursorStyle,
      cursorBlink: config.blinkingCursor,
      fontInfo,
      fontSizePt: config.terminalFontSize,
      fontSizePx: terminalFontSizePx,
      extraFonts,
      palette: this.#extractPalette(terminalTheme, transparentBackground),
      terminalTheme,
      transparentBackground,
      useLigatures: config.terminalDisplayLigatures,
      ligatureMarker,
      windowDpr: this.getDpr(),
      screenHeightHintPx: 1024, // FIXME
      screenWidthHintPx: 1024,  // FIXME
    };
    return terminalVisualConfig;
  }

  getId(): number {
    return this.#id;
  }

  getDpi(): number {
    const window = this.dockContainer;
    const screen = window.isVisible() ? window.windowHandle().screen() : QApplication.primaryScreen();
    return screen.logicalDotsPerInch();
  }

  getDpr(): number {
    const window = this.dockContainer;
    const screen = window.isVisible() ? window.windowHandle().screen() : QApplication.primaryScreen();
    return screen.devicePixelRatio();
  }

  async #handleConfigChangeEvent(event: ConfigChangeEvent): Promise<void> {
    if (event.key !== GENERAL_CONFIG) {
      return;
    }
    const oldConfig = <GeneralConfig> event.oldConfig;
    const newConfig = <GeneralConfig> event.newConfig;

    if (oldConfig.uiScalePercent !== newConfig.uiScalePercent) {
      this.#loadStyleSheet(newConfig.uiScalePercent / 100);
    }

    if (!(oldConfig.terminalFont === newConfig.terminalFont &&
        oldConfig.terminalFontSize === newConfig.terminalFontSize &&
        oldConfig.cursorStyle === newConfig.cursorStyle &&
        oldConfig.themeTerminal === newConfig.themeTerminal &&
        oldConfig.terminalDisplayLigatures === newConfig.terminalDisplayLigatures &&
        oldConfig.terminalMarginStyle === newConfig.terminalMarginStyle)) {
      await this.#updateTerminalVisualConfig();
    }

    if (oldConfig.titleBarStyle !== newConfig.titleBarStyle) {
      // this.#setWindowFrame(newConfig.titleBarStyle);
    }

    if (oldConfig.minimizeToTray !== newConfig.minimizeToTray) {
      if (newConfig.minimizeToTray && newConfig.showTrayIcon) {
        this.#convertToMinimizeToTray();
      }
      if ( ! newConfig.minimizeToTray) {
        this.#convertToNormalMinimize();
      }
    }
  }

  async #updateTerminalVisualConfig(): Promise<void> {
    // this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
    // for (const tab of this.#tabs) {
    //   if (tab.tab instanceof Terminal) {
    //     tab.tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    //   }
    //   if (tab.tab instanceof SettingsTab) {
    //     tab.tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    //   }
    // }
  }

  #extractPalette(terminalTheme: TerminalTheme, transparentBackground: boolean): number[] {
    const palette = this.#extractPaletteFromTerminalVisualConfig(terminalTheme);
    if (transparentBackground) {
      palette[256] = 0x00000000;
    }
    return palette;
  }

  #extractPaletteFromTerminalVisualConfig(terminalTheme: TerminalTheme): number[] {
    const result: number[] = [];
    for (let i=0; i<256; i++) {
      result.push(cssHexColorToRGBA(terminalTheme[i]));
    }

    result.push(cssHexColorToRGBA(terminalTheme.backgroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.foregroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.cursorBackgroundColor));

    return result;
  }

  #pointsToPx(point: number, dpi: number): number {
    return point * dpi / 72;
  }

  #getFontInfo(fontId: string): FontInfo {
    const systemConfig = this.#configDatabase.getSystemConfig();
    for (const fontInfo of systemConfig.availableFonts) {
      if (fontInfo.id === fontId) {
        return fontInfo;
      }
    }
    return null;
  }

  open(): void {
    this.dockContainer.show();

    this.#windowHandle = this.dockContainer.windowHandle();
    this.#windowHandle.addEventListener("screenChanged", (screen: QScreen) => {
      this.#watchScreen(screen);
      this.#handleDpiAndDprChanged(this.#screen.logicalDotsPerInch(), this.#screen.devicePixelRatio());
    });
    this.#windowHandle.addEventListener("visibilityChanged", (visibility: Visibility) => {
      this.#onWindowGeometryChangedEventEmitter.fire();
    });
    this.#windowHandle.addEventListener("windowStateChanged", (windowState: WindowState) => {
      this.#handleWindowStateChanged(windowState);
    });
    this.#windowOpenState = WindowOpenState.Open;

    if (this.getDpi() !== this.#lastConfigDpi || this.getDpr() !== this.#lastConfigDpr) {
      this.#updateTerminalVisualConfig();
    }
    this.#moveOnScreen();
  }

  #moveOnScreen(): void {
    const screenGeometry = this.dockContainer.windowHandle().screen().geometry();
    const windowGeometry = this.dockContainer.geometry();

    let changed = false;
    let windowWidth = windowGeometry.width();
    if (windowWidth > screenGeometry.width()) {
      windowWidth = screenGeometry.width();
      changed = true;
    }

    let windowHeight = windowGeometry.height();
    if (windowHeight > screenGeometry.height()) {
      windowHeight = screenGeometry.height();
      changed = true;
    }

    let windowLeft = windowGeometry.left();
    if (windowLeft < 0) {
      windowLeft = 0;
      changed = true;
    }
    if (windowLeft > screenGeometry.width() - windowWidth) {
      windowLeft = screenGeometry.width() - windowWidth;
    }

    let windowTop = windowGeometry.top();
    if (windowTop < 0) {
      windowTop = 0;
      changed = true;
    }
    if (windowTop > screenGeometry.height() - windowHeight) {
      windowTop = screenGeometry.height() - windowHeight;
      changed = true;
    }

    if (changed) {
      this.dockContainer.setGeometry(windowLeft, windowTop, windowWidth, windowHeight);
    }
  }

  dispose(): void {
    // Terminate any running terminal tabs.
    // for (const tab of this.#tabs) {
    //   this.removeTab(tab.tab);
    //   tab.tab.dispose();
    // }

    if (this.#windowOpenState !== WindowOpenState.Closed &&
        this.#windowOpenState !== WindowOpenState.ClosedMinimized) {
      this.dockContainer.close();
    }
  }

  isMaximized(): boolean {
    return this.#windowHandle.visibility() === Visibility.Maximized;
  }

  maximize(): void {
    this.dockContainer.showMaximized();
    this.#windowOpenState = WindowOpenState.Open;
  }

  minimize(): void {
    const config = this.#configDatabase.getGeneralConfig();
    if (config.showTrayIcon && config.minimizeToTray) {
      this.dockContainer.hide();
      this.#windowOpenState = WindowOpenState.ClosedMinimized;
    } else {
      this.dockContainer.showMinimized();
      this.#windowOpenState = WindowOpenState.Minimized;
    }
  }

  isMinimized(): boolean {
    return this.#windowOpenState === WindowOpenState.Minimized || this.#windowOpenState === WindowOpenState.ClosedMinimized;
  }

  restore(): void {
    this.dockContainer.hide();
    this.dockContainer.showNormal();
    this.#windowOpenState = WindowOpenState.Open;
  }

  raise(): void {
    this.dockContainer.activateWindow();
    this.dockContainer.raise();
  }

  #convertToMinimizeToTray(): void {
    if (this.#windowOpenState === WindowOpenState.Minimized) {
      this.dockContainer.hide();
      this.#windowOpenState = WindowOpenState.ClosedMinimized;
    }
  }

  #convertToNormalMinimize(): void {
    if (this.#windowOpenState === WindowOpenState.ClosedMinimized) {
      this.dockContainer.showMinimized();
      this.#windowOpenState = WindowOpenState.Minimized;
    }
  }

  #handleWindowStateChanged(windowState: WindowState): void {
    if (windowState === WindowState.WindowMinimized) {
      const config = this.#configDatabase.getGeneralConfig();
      if (config.showTrayIcon && config.minimizeToTray) {
        this.dockContainer.hide();
        this.#windowOpenState = WindowOpenState.ClosedMinimized;
      } else {
        this.#windowOpenState = WindowOpenState.Minimized;
      }
    }
  }

  getGeometry(): QRect {
    return this.dockContainer.geometry();
  }

  #handleLogicalDpiChanged: (dpi: number) => void;

  #UnboundHandleLogicalDpiChanged(dpi: number): void {
    this.#handleDpiAndDprChanged(dpi, this.#screen.devicePixelRatio());
  }

  #handleDpiAndDprChanged(dpi: number, dpr: number): void {
    if (dpi !== this.#lastConfigDpi || dpr !==this.#lastConfigDpr) {
      this.#updateTerminalVisualConfig();
    }
  }

  #watchScreen(screen: QScreen): void {
    if (this.#screen != null) {
      this.#screen.removeEventListener("logicalDotsPerInchChanged",  this.#handleLogicalDpiChanged);
    }

    this.#screen = screen;
    this.#screen.addEventListener("logicalDotsPerInchChanged",  this.#handleLogicalDpiChanged);
  }

  isActiveWindow(): boolean {
    return this.dockContainer.isActiveWindow();
  }

  getWidget(): QWidget {
    return this.dockContainer;
  }

  @log
  setCurrentTabIndex(index: number): void {
    const tabs = this.#getTabs();
    const noTabs = tabs.length === 0;
    if (noTabs) {
      this.#onTabChangeEventEmitter.fire(null);
      return;
    }

    const currentIndex = this.getCurrentTabIndex();
    tabs[currentIndex].unfocus();

    for (let i=0; i<tabs.length; i++) {
      const tab = tabs[i];
      const isCurrent = i === index;
      // if (tabPlumbing.titleLabel != null) {
      //   tabPlumbing.titleLabel.setProperty("cssClass", isCurrent ? ["tab-title", "tab-title-selected"] : ["tab-title"]);
      //   repolish(tabPlumbing.titleLabel);
      // }
      tab.setIsCurrent(isCurrent);
    }
    const currentTab = tabs[index];
    currentTab.focus();

    this.#onTabChangeEventEmitter.fire(currentTab);
  }


  #getTabs(): Tab[] {
    const result: Tab[] = [];
    for (const dockWidget of this.dockContainer.dockWidgets()) {
      const plumbing = getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null) {
        result.push(plumbing.tab);
      }
    }
    return result;
  }

  getCurrentTabIndex(): number {
    return this.dockContainer.dockContainer().dockArea(0).currentIndex() -1;
  }

  getTabCount(): number {
    return this.#getTabs().length;
  }

  getTab(index: number): Tab {
    return this.#getTabs()[index];
  }

  addTab(tab: Tab, preTabHeader?: () => void): void {
    if (allTabs.map(t => t.tab).includes(tab)) {
      return;
    }

    const tabPlumbing = new TabPlumbing(tab);
    tab.setParent(this);
    allTabs.push(tabPlumbing);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }
    if (tab instanceof SettingsTab) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    const dockAreaWidget = this.dockContainer.dockContainer().dockArea(0);
    if (tab.getTitle() != null) {
      tabPlumbing.dockWidget.setWindowTitle(tab.getTitle());
    }
    this.#dockManager.addDockWidgetTabToArea(tabPlumbing.dockWidget, dockAreaWidget);

    if (preTabHeader != null) {
      preTabHeader();
    }

    let tabTitleWidget = tab.getTabWidget();
    if (tabTitleWidget == null) {
      const iconName = tab.getIconName();
      const iconHtml = iconName != null ? createHtmlIcon(iconName) + "  " : "";
      const titleHtml = `${iconHtml}${he.escape(tab.getTitle() ?? "")}`;
      const tabTitleLabel = Label({
        cssClass: ["tab-title"],
        contentsMargins: [8, 0, 0, 0],
        text: titleHtml,
        textFormat: TextFormat.RichText
      });
      tabTitleWidget = tabTitleLabel;
      tabPlumbing.titleLabel = tabTitleLabel;
    }
    tabPlumbing.titleWidget = tabTitleWidget;

    const tabWidget = tabPlumbing.dockWidget.tabWidget();
    const layout = <QBoxLayout> tabWidget.layout();
    layout.insertWidget(0, tabPlumbing.titleWidget);
  }

  tabPopOutClicked(details: {frame: DecoratedFrame, terminal: Terminal}): void {
    this.#onPopOutClickedEventEmitter.fire({
      window: this,
      terminal: details.terminal,
      frame: details.frame
    });
  }

  handleTabWindowTitleChanged(tab: Tab, title: string): void {
    // TODO: Should this just be moved into TabPlumbing directly?
    const tabPlumbing = getTabPlumbingForTab(tab);
    tabPlumbing.dockWidget.setWindowTitle(title);
  }

  hasTab(targetTab: Tab): boolean {
    for (const dockWidget of this.dockContainer.dockWidgets()) {
      const plumbing = getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null && plumbing.tab === targetTab) {
        return true;
      }
    }
    return false;
  }

  focus(): void {
    this.dockContainer.setFocus();
    this.dockContainer.raise();
  }

  removeTab(targetTab: Tab): void {
    const tabPlumbing = getTabPlumbingForTab(targetTab);
    if (tabPlumbing == null) {
      return;
    }
    tabPlumbing.dispose();
  }

  focusTab(tab: Tab): void {
    const tabPlumbing = getTabPlumbingForTab(tab);
    tabPlumbing.dockWidget.dockAreaWidget().setCurrentDockWidget(tabPlumbing.dockWidget);
    tab.focus();
    // FIXME: update any context related state
  }

  getTabGlobalGeometry(tab: Tab): QRect {
    const tabPlumbing = getTabPlumbingForTab(tab);
    const localGeometry = tabPlumbing.dockWidget.geometry();
    const topLeftGlobal = this.dockContainer.mapToGlobal(new QPoint(localGeometry.left(), localGeometry.top()));
    return new QRect(topLeftGlobal.x(), topLeftGlobal.y(), localGeometry.width(), localGeometry.height());
  }

  getTerminals(): Terminal[] {
    const result: Terminal[] = [];
    for (const dockWidget of this.dockContainer.dockWidgets()) {
      const plumbing = getTabPlumbingForDockWidget(dockWidget);
      if (plumbing != null && plumbing.tab instanceof Terminal) {
        result.push(plumbing.tab);
      }
    }
    return result;
  }

  getUiStyle(): UiStyle {
    return this.#uiStyle;
  }
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
