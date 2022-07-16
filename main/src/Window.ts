/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import { Logger, log, getLogger } from "extraterm-logging";
import { FontSlice } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-timeoutqt";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QStackedWidget, QTabBar, QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction,
  FocusPolicy, QKeyEvent, WidgetAttribute, QPoint, QRect, QKeySequence, QWindow, QScreen, QApplication,
  ContextMenuPolicy, QSizePolicyPolicy, QBoxLayout, AlignmentFlag, ButtonPosition, QLabel, TextFormat, QMouseEvent,
  MouseButton, Visibility, QIcon, QSize } from "@nodegui/nodegui";
import { BoxLayout, StackedWidget, Menu, TabBar, ToolButton, Widget, Label, repolish } from "qt-construct";
import { loadFile as loadFontFile} from "extraterm-font-ligatures";
import he from "he";
import { hasEmojiPresentation } from "extraterm-unicode-utilities";

import * as SourceDir from "./SourceDir.js";
import { FontInfo, GeneralConfig, GENERAL_CONFIG, TitleBarStyle } from "./config/Config.js";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase.js";
import { Tab } from "./Tab.js";
import { Terminal } from "./terminal/Terminal.js";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig.js";
import { ThemeManager } from "./theme/ThemeManager.js";
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { qKeyEventToMinimalKeyboardEvent } from "./keybindings/QKeyEventUtilities.js";
import { UiStyle } from "./ui/UiStyle.js";
import { CachingLigatureMarker, LigatureMarker } from "./CachingLigatureMarker.js";
import { DisposableHolder } from "./utils/DisposableUtils.js";
import { HoverPushButton } from "./ui/QtConstructExtra.js";
import { BorderlessWindowSupport } from "./BorderlessWindowSupport.js";
import { createHtmlIcon } from "./ui/Icons.js";
import { SettingsTab } from "./settings/SettingsTab.js";
import { ContextMenuEvent } from "./ContextMenuEvent.js";
import { DecoratedFrame } from "./terminal/DecoratedFrame.js";
import { TWEMOJI_FAMILY } from "./TwemojiConstants.js";
import { BlockFrame } from "./terminal/BlockFrame.js";
import { CommonExtensionWindowState } from "./extension/CommonExtensionState.js";


export interface PopOutClickedDetails {
  window: Window;
  frame: DecoratedFrame;
  terminal: Terminal;
}

interface TabPlumbing {
  tab: Tab;
  disposableHolder: DisposableHolder;
  titleLabel: QLabel;
  titleWidget: QWidget;
}

export class Window {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;

  #windowWidget: QWidget = null;
  #borderlessWindowSupport: BorderlessWindowSupport = null;
  #windowHandle: QWindow = null;
  #screen: QScreen = null;
  #topLayout: QBoxLayout = null;
  #tabBarLayout: QBoxLayout = null;
  #topBar: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;
  #lastConfigDpi = -1;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;

  #contextMenu: QMenu = null;

  #tabs: TabPlumbing[] = [];
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

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager,
      keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager, uiStyle: UiStyle) {

    this._log = getLogger("Window", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;

    this.#handleLogicalDpiChanged.bind(this);

    this.onTabCloseRequest = this.#onTabCloseRequestEventEmitter.event;
    this.onTabChange = this.#onTabChangeEventEmitter.event;
    this.onWindowGeometryChanged = this.#onWindowGeometryChangedEventEmitter.event;
    this.onPopOutClicked = this.#onPopOutClickedEventEmitter.event;
  }

  async init(geometry: QRect): Promise<void> {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    this.#configDatabase.onChange((event: ConfigChangeEvent) => this.#handleConfigChangeEvent(event));

    this.#windowWidget = Widget({
      windowTitle: "Extraterm Qt",
      focusPolicy: FocusPolicy.ClickFocus,
      contextMenuPolicy: ContextMenuPolicy.PreventContextMenu,
      cssClass: ["window-background"],
      onKeyPress: (nativeEvent) => {
        this.#handleKeyPress(new QKeyEvent(nativeEvent));
      },
      onMove: (nativeEvent) => {
        this.#onWindowGeometryChangedEventEmitter.fire();
      },
      onResize:(nativeEvent) => {
        this.#onWindowGeometryChangedEventEmitter.fire();
      },
      windowIcon: this.#createWindowIcon(),
      mouseTracking: true,
      layout: this.#topLayout = BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: 0,
        spacing: 0,
        children: [
          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              spacing: 0,
              children: [
                {
                  widget: this.#tabBar = TabBar({
                    expanding: false,
                    cssClass: ["top-level"],
                    tabs: [],
                    onCurrentChanged: (index: number) => {
                      this.#handleTabBarChanged(index);
                    },
                    tabsClosable: true,
                    onTabCloseRequested: (index: number) => {
                      this.#handleTabBarCloseClicked(index);
                    },
                    onMouseButtonPress: (nativeEvent) => {
                      this.#handleTabMouseButtonPress(new QMouseEvent(nativeEvent));
                    }
                  }),
                  stretch: 0
                },

                {
                  widget: Widget({
                    cssClass: ["tabbar-gap"],
                    layout: this.#tabBarLayout = BoxLayout({
                      direction: Direction.LeftToRight,
                      contentsMargins: [0, 0, 0, 0],
                      spacing: 0,
                      children: [
                        {
                          widget: this.#createDragAreaWidget(),
                          stretch: 1
                        },
                        {
                          widget: this.#createHamburgerMenu(this.#uiStyle),
                          stretch: 0,
                          alignment: AlignmentFlag.AlignTop
                        },
                      ]
                    })
                  }),
                  stretch: 1
                }
              ]
            })
          }),
          this.#contentStack = StackedWidget({children: []})
        ]
      })
    });

    if (geometry != null) {
      this.#windowWidget.setGeometry(geometry.left(), geometry.top(), geometry.width(), geometry.height());
    } else {
      this.#windowWidget.resize(800, 480);
    }

    this.#borderlessWindowSupport = new BorderlessWindowSupport(this.#windowWidget);
    this.#borderlessWindowSupport.registerDecoration(this.#windowWidget, this.#hamburgerMenuButton);
    this.#setWindowFrame(generalConfig.titleBarStyle);

    this.#loadStyleSheet(generalConfig.uiScalePercent/100);

    this.#initContextMenu();

    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
  }

  #loadStyleSheet(uiScale: number): void {
    this.#windowWidget.setStyleSheet("", false);
    this.#hamburgerMenu.setStyleSheet("", false);
    if (process.platform === "darwin") {
      uiScale *= 1.5; // Make everything bigger on macOS to more closely match native apps.
                      // Note: This factor appears in main.ts:#setApplicationStyle too.
    }
    const sheet = this.#uiStyle.getApplicationStyleSheet(uiScale, this.getDpi());
    this.#windowWidget.setStyleSheet(sheet, false);
    this.#hamburgerMenu.setStyleSheet(sheet, false);

    this.#repolishTabBar();
  }

  #createWindowIcon(): QIcon {
    const windowIcon = new QIcon();
    for (const size of [16, 22, 32, 64, 256]) {
      const iconPath = path.join(SourceDir.path, `../resources/logo/extraterm_small_logo_${size}x${size}.png`);
      windowIcon.addFile(iconPath, new QSize(size, size));
    }
    return windowIcon;
  }

  #repolishTabBar(): void {
    repolish(this.#tabBar);

    // This is a hack to force a repolish of the widgets inside the tabs.
    for (const [index, tabInfo] of this.#tabs.entries()) {
      this.#tabBar.setTabButton(index, ButtonPosition.LeftSide, null);
      this.#tabBar.setTabButton(index, ButtonPosition.LeftSide, tabInfo.titleWidget);
    }
  }

  #createDragAreaWidget(): QWidget {
    return Widget({
      onMouseButtonPress: (ev) => {
        this.#windowWidget.windowHandle().startSystemMove();
      },
    });
  }

  #createTopBar(): QWidget {
    let minimizeButton: QWidget = null;
    let maximizeButton: QWidget = null;
    let closeButton: QWidget = null;

    const topBarWidget = Widget({
      contentsMargins: 0,
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        spacing: 0,
        contentsMargins: 0,
        children: [
          {
            widget: Widget({
              minimumHeight: 11,
              minimumWidth: 16,
              onMouseButtonPress: (ev) => {
                this.#windowWidget.windowHandle().startSystemMove();
              }
            }),
            stretch: 1
          },
          {
            widget: minimizeButton = HoverPushButton({
              cssClass: ["window-control", "plain"],
              iconPair: this.#uiStyle.getToolbarButtonIconPair("extraicons-minimize"),
              sizePolicy: {
                horizontal: QSizePolicyPolicy.Fixed,
                vertical: QSizePolicyPolicy.Fixed,
              },
              onClicked: () => {
                this.#windowWidget.showMinimized();
              },
            }),
            stretch: 0
          },
          {
            widget: maximizeButton = HoverPushButton({
              cssClass: ["window-control", "plain"],
              iconPair: this.#uiStyle.getToolbarButtonIconPair("extraicons-maximize"),
              sizePolicy: {
                horizontal: QSizePolicyPolicy.Fixed,
                vertical: QSizePolicyPolicy.Fixed,
              },
              onClicked: () => {
                if (this.#windowWidget.isMaximized()) {
                  this.#windowWidget.showNormal();
                } else {
                  this.#windowWidget.showMaximized();
                }
              }
            }),
            stretch: 0
          },
          {
            widget: closeButton = HoverPushButton({
              cssClass: ["window-control", "danger"],
              iconPair: this.#uiStyle.getToolbarButtonIconPair("fa-times"),
              sizePolicy: {
                horizontal: QSizePolicyPolicy.Fixed,
                vertical: QSizePolicyPolicy.Fixed,
              },
              onClicked: () => {
                this.close();
              }
            }),
            stretch: 0
          },
        ]
      })
    });

    this.#borderlessWindowSupport.registerDecoration(this.#windowWidget, minimizeButton);
    this.#borderlessWindowSupport.registerDecoration(this.#windowWidget, maximizeButton);
    this.#borderlessWindowSupport.registerDecoration(this.#windowWidget, closeButton);

    return topBarWidget;
  }

  #setWindowFrame(titleBarStyle: TitleBarStyle): void {
    switch(titleBarStyle) {
      case "native":
        this.#windowWidget.setContentsMargins(0, 8, 0, 0);
        this.#borderlessWindowSupport.disable();
        if (this.#topBar != null) {
          this.#topBar.setParent(null);
        }
        break;

      case "theme":
        this.#windowWidget.setContentsMargins(0, 0, 0, 0);
        this.#borderlessWindowSupport.enable();

        if (this.#topBar == null) {
          this.#topBar = this.#createTopBar();
        }
        this.#topBar.setParent(null);

        this.#topLayout.insertWidget(0, this.#topBar, 0);

        break;

      case "compact":
        this.#windowWidget.setContentsMargins(0, 0, 0, 0);
        this.#borderlessWindowSupport.enable();

        if (this.#topBar == null) {
          this.#topBar = this.#createTopBar();
        }
        this.#topBar.setParent(null);

        this.#tabBarLayout.addWidget(this.#topBar, 0, AlignmentFlag.AlignTop);
        break;
    }
  }

  #createHamburgerMenu(uiStyle: UiStyle): QToolButton {
    const iconPair = uiStyle.getToolbarButtonIconPair("fa-bars");

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
        this.#updateHamburgerMenu(uiStyle);
      },
      menu: this.#hamburgerMenu = Menu({
        attribute: [WidgetAttribute.WA_TranslucentBackground],
        onTriggered: (nativeAction) => {
          const action = new QAction(nativeAction);
          this.#handleWindowMenuTriggered(action.data().toString());
        }
      })
    });

    this.#updateHamburgerMenu(uiStyle);

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

  #openContextMenu(uiStyle: UiStyle, terminal: Terminal, blockFrame: BlockFrame, x: number, y: number): void {
    const options: CommandQueryOptions = {
      when: true,
      contextMenu: true,
    };

    const state = this.#extensionManager.copyExtensionWindowState();
    state.activeTerminal = terminal;
    state.activeBlockFrame = blockFrame;
    this.#contextMenuState = state;
    this.#updateMenu(this.#contextMenu, uiStyle, options, state);

    this.#contextMenu.popup(new QPoint(x, y));
  }

  #contextMenuState: CommonExtensionWindowState = null;

  #handleContextMenuTriggered(context: CommonExtensionWindowState, commandName: string): void {
    doLater( () => {
      try {
        this.#extensionManager.executeCommandWithExtensionWindowState(context, commandName);
        this.#contextMenuState = null;
      } catch(e) {
        this._log.warn(e);
      }
    });
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

  #handleTabMouseButtonPress(ev: QMouseEvent): void {
    const isContextMenu = ev.button() === MouseButton.RightButton;
    if (!isContextMenu) {
      return;
    }

    const tabIndex = this.#tabBar.tabAt(new QPoint(ev.x(), ev.y()));
    this.setCurrentTabIndex(tabIndex);

    const options: CommandQueryOptions = {
      when: true,
      terminalTitleMenu: true,
    };
    this.#updateMenu(this.#contextMenu, this.#uiStyle, options);
    this.#contextMenu.popup(new QPoint(ev.globalX(), ev.globalY()));
  }

  #handleTabBarChanged(index: number): void {
    if (index < 0 || index >= this.#tabs.length) {
      return;
    }
    this.setCurrentTabIndex(index);
  }

  #handleTabBarCloseClicked(index: number): void {
    this.#onTabCloseRequestEventEmitter.fire(this.#tabs[index].tab);
  }

  #handleKeyPress(event: QKeyEvent): void {
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
    const terminalFontSizePx = Math.round(this.#pointsToPx(config.terminalFontSize, this.#lastConfigDpi));

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
      screenHeightHintPx: 1024, // FIXME
      screenWidthHintPx: 1024,  // FIXME
    };
    return terminalVisualConfig;
  }

  getDpi(): number {
    const window = this.#windowWidget;
    const screen = window.isVisible() ? window.windowHandle().screen() : QApplication.primaryScreen();
    return screen.logicalDotsPerInch();
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
      this.#setWindowFrame(newConfig.titleBarStyle);
    }
  }

  async #updateTerminalVisualConfig(): Promise<void> {
    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
    for (const tab of this.#tabs) {
      if (tab.tab instanceof Terminal) {
        tab.tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      }
      if (tab.tab instanceof SettingsTab) {
        tab.tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      }
    }
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
    this.#windowWidget.show();

    this.#windowHandle = this.#windowWidget.windowHandle();
    this.#windowHandle.addEventListener("screenChanged", (screen: QScreen) => {
      this.#watchScreen(screen);
      this.#handleLogicalDpiChanged(this.#screen.logicalDotsPerInch());
    });
    this.#windowHandle.addEventListener("visibilityChanged", (visibility: Visibility) => {
      this.#onWindowGeometryChangedEventEmitter.fire();
    });
  }

  close(): void {
    // Terminate any running terminal tabs.
    for (const tab of this.#tabs) {
      this.removeTab(tab.tab);
    }

    this.#windowWidget.close();
  }

  isMaximized(): boolean {
    return this.#windowHandle.visibility() === Visibility.Maximized;
  }

  maximize(): void {
    this.#windowWidget.showMaximized();
  }

  minimize(): void {
    this.#windowWidget.showMinimized();
  }

  restore(): void {
    this.#windowWidget.showNormal();
  }

  getGeometry(): QRect {
    return this.#windowWidget.geometry();
  }

  #handleLogicalDpiChanged(dpi: number): void {
    if (dpi !== this.#lastConfigDpi) {
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
    return this.#windowWidget.isActiveWindow();
  }

  getWidget(): QWidget {
    return this.#windowWidget;
  }

  setCurrentTabIndex(index: number): void {
    const currentIndex = this.getCurrentTabIndex();
    this.#tabs[currentIndex].tab.unfocus();

    for (let i=0; i<this.#tabs.length; i++) {
      const tabPlumbing =  this.#tabs[i];
      const isCurrent = i === index;
      if (tabPlumbing.titleLabel != null) {
        tabPlumbing.titleLabel.setProperty("cssClass", isCurrent ? ["tab-title", "tab-title-selected"] : ["tab-title"]);
        repolish(tabPlumbing.titleLabel);
      }
      tabPlumbing.tab.setIsCurrent(isCurrent);
    }

    this.#tabBar.setCurrentIndex(index);
    this.#contentStack.setCurrentIndex(index);
    const tab = this.#tabs[index].tab;
    tab.focus();

    this.#windowWidget.setWindowTitle(tab.getWindowTitle());

    this.#onTabChangeEventEmitter.fire(tab);
  }

  getCurrentTabIndex(): number {
    return this.#tabBar.currentIndex();
  }

  getTabCount(): number {
    return this.#tabs.length;
  }

  getTab(index: number): Tab {
    return this.#tabs[index]?.tab;
  }

  addTab(tab: Tab, preTabHeader?: () => void): void {
    if (this.#tabs.map(t => t.tab).includes(tab)) {
      return;
    }
    const tabPlumbing: TabPlumbing = { tab, disposableHolder: new DisposableHolder(), titleLabel: null,
      titleWidget: null };
    this.#tabs.push(tabPlumbing);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      tabPlumbing.disposableHolder.add(tab.onContextMenu((ev: ContextMenuEvent) => {
        this.#openContextMenu(this.#uiStyle, ev.terminal, ev.blockFrame, ev.x, ev.y);
      }));
    }
    if (tab instanceof Terminal) {
      tabPlumbing.disposableHolder.add(tab.onPopOutClicked((details) => {
        this.#onPopOutClickedEventEmitter.fire({
          window: this,
          terminal: details.terminal,
          frame: details.frame
        });
      }));
    }
    if (tab instanceof SettingsTab) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }
    this.#contentStack.addWidget(tab.getContents());

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

    const index = this.#tabBar.addTab(null, "");
    this.#tabBar.setTabButton(index, ButtonPosition.LeftSide, tabTitleWidget);

    tabPlumbing.disposableHolder.add(tab.onWindowTitleChanged((title: string) => {
      this.#handleTabWindowTitleChanged(tab, title);
    }));
  }

  #handleTabWindowTitleChanged(tab: Tab, title: string): void {
    if (this.#tabs.length === 0) {
      return;
    }
    if (this.#tabs[this.#tabBar.currentIndex()].tab !== tab) {
      return;
    }
    this.#windowWidget.setWindowTitle(title);
  }

  hasTab(targetTab: Tab): boolean {
    for (const [index, tab] of this.#tabs.entries()) {
      if (targetTab === tab.tab) {
        return true;
      }
    }
    return false;
  }

  focus(): void {
    this.#windowWidget.setFocus();
    this.#windowWidget.raise();
  }

  removeTab(targetTab: Tab): boolean {
    for (const [index, tab] of this.#tabs.entries()) {
      if (targetTab === tab.tab) {
        this.#tabBar.setTabButton(index, ButtonPosition.LeftSide, null);
        tab.titleWidget.setParent(null);
        this.#tabBar.removeTab(index);
        this.#contentStack.removeWidget(tab.tab.getContents());
        this.#tabs.splice(index, 1);

        tab.disposableHolder.dispose();
        const newCurrentIndex = Math.max(0, index - 1);
        if (this.#tabs.length !== 0) {
          this.setCurrentTabIndex(newCurrentIndex);
        }

        return true;
      }
    }
    return false;
  }

  focusTab(tab: Tab): void {
    const index = this.#tabs.map(t => t.tab).indexOf(tab);
    if (index === -1) {
      return;
    }
    this.setCurrentTabIndex(index);
    tab.focus();
  }

  getTabGlobalGeometry(tab: Tab): QRect {
    const localGeometry = this.#contentStack.geometry();
    const topLeftGlobal = this.#windowWidget.mapToGlobal(new QPoint(localGeometry.left(), localGeometry.top()));
    return new QRect(topLeftGlobal.x(), topLeftGlobal.y(), localGeometry.width(), localGeometry.height());
  }

  getTerminals(): Terminal[] {
    const result: Terminal[] = [];
    for (const tp of this.#tabs) {
      if (tp.tab instanceof Terminal) {
        result.push(tp.tab);
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
