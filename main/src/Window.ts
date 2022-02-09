/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { FontSlice } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-later";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QStackedWidget, QTabBar, QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction,
  FocusPolicy, QKeyEvent, WidgetAttribute, QIcon, QPoint, QRect, QKeySequence, QWindow, QScreen, QApplication,
  ContextMenuPolicy, QSizePolicyPolicy, QBoxLayout, AlignmentFlag } from "@nodegui/nodegui";
import { BoxLayout, StackedWidget, Menu, TabBar, ToolButton, Widget } from "qt-construct";
import { loadFile as loadFontFile} from "extraterm-font-ligatures";

import { FontInfo, GeneralConfig, GENERAL_CONFIG, TitleBarStyle } from "./config/Config";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase";
import { Tab } from "./Tab";
import { ContextMenuEvent, Terminal } from "./terminal/Terminal";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig";
import { ThemeManager } from "./theme/ThemeManager";
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager";
import { qKeyEventToMinimalKeyboardEvent } from "./keybindings/QKeyEventUtilities";
import { UiStyle } from "./ui/UiStyle";
import { CachingLigatureMarker, LigatureMarker } from "./CachingLigatureMarker";
import { DisposableHolder } from "./utils/DisposableUtils";
import { HoverPushButton } from "./ui/QtConstructExtra";
import { BorderlessWindowSupport } from "./BorderlessWindowSupport";


interface TabPlumbing {
  tab: Tab;
  disposableHolder: DisposableHolder;
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
  #tabRowWidget: QWidget = null;
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
  }

  async init(): Promise<void> {
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
      mouseTracking: true,
      layout: this.#topLayout = BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: 0,
        spacing: 0,
        children: [
          this.#tabRowWidget = Widget({
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

    this.#borderlessWindowSupport = new BorderlessWindowSupport(this.#windowWidget);
    this.#setWindowFrame(generalConfig.titleBarStyle);

    this.#loadStyleSheet(generalConfig.uiScalePercent/100);
    this.#windowWidget.resize(800, 480);

    this.#initContextMenu();

    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
  }

  #loadStyleSheet(uiScale: number): void {
    this.#windowWidget.setStyleSheet("");
    this.#hamburgerMenu.setStyleSheet("");
    const sheet = this.#uiStyle.getApplicationStyleSheet(uiScale, this.#getWindowDpi());
    this.#windowWidget.setStyleSheet(sheet);
    this.#hamburgerMenu.setStyleSheet(sheet);
  }

  #createDragAreaWidget(): QWidget {
    return Widget({
      onMouseButtonPress: (ev) => {
        this.#windowWidget.windowHandle().startSystemMove();
      },
    });
  }

  #createTopBar(): QWidget {
    return Widget({
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
            widget: HoverPushButton({
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
            widget: HoverPushButton({
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
            widget: HoverPushButton({
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
    this.#updateMenu(this.#hamburgerMenu, options, uiStyle);
  }

  #updateMenu(menu: QMenu, options: CommandQueryOptions, uiStyle: UiStyle): void {
    menu.clear();

    const entries = this.#extensionManager.queryCommands(options);
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
      if (entry.icon != null) {
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
        this.#handleWindowMenuTriggered(action.data().toString());
      }
    });
    this.#contextMenu.setNodeParent(this.getWidget());
  }

  #updateContextMenu(uiStyle: UiStyle): void {
    const options: CommandQueryOptions = {
      when: true,
      contextMenu: true,
    };
    this.#updateMenu(this.#contextMenu, options, uiStyle);
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
        fontFamily: "twemoji",
        fontSizePx: 16,
        unicodeStart: 0x1f000,
        unicodeEnd: 0x20000,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ];

    this.#lastConfigDpi = this.#getWindowDpi();
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

  #getWindowDpi(): number {
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
  }

  close(): void {

    // Terminate any running terminal tabs.



    this.#windowWidget.close();
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

    this.#tabBar.setCurrentIndex(index);
    this.#contentStack.setCurrentIndex(index);
    this.#tabs[index].tab.focus();

    this.#onTabChangeEventEmitter.fire(this.#tabs[index].tab);
  }

  getCurrentTabIndex(): number {
    return this.#tabBar.currentIndex();
  }

  getTabCount(): number {
    return this.#tabs.length;
  }

  getTab(index: number): Tab {
    return this.#tabs[index].tab;
  }

  addTab(tab: Tab): void {
    if (this.#tabs.map(t => t.tab).includes(tab)) {
      return;
    }
    const tabPlumbing: TabPlumbing = {tab, disposableHolder: new DisposableHolder()};
    this.#tabs.push(tabPlumbing);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
      tabPlumbing.disposableHolder.add(tab.onContextMenu((ev: ContextMenuEvent) => {

        this.#updateContextMenu(this.#uiStyle);
        this.#contextMenu.popup(new QPoint(ev.x, ev.y));
      }));
    }

    const header = tab.getTitle();
    const iconName = tab.getIconName();
    let icon: QIcon = null;
    if (iconName != null) {
      icon = this.#uiStyle.getTabIcon(iconName);
    }
    this.#tabBar.addTab(icon, header);

    this.#contentStack.addWidget(tab.getContents());
  }

  removeTab(targetTab: Tab): boolean {
    for (const [index, tab] of this.#tabs.entries()) {
      if (targetTab === tab.tab) {
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
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
