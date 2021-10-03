/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { computeFontMetrics, computeEmojiMetrics, FontSlice } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-later";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QStackedWidget, QTabBar, QWidget, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction,
  FocusPolicy, QKeyEvent, WidgetAttribute, QIcon, QPoint, QRect } from "@nodegui/nodegui";
import { BoxLayout, StackedWidget, Menu, TabBar, ToolButton, Widget } from "qt-construct";
import { loadFile as loadFontFile} from "extraterm-font-ligatures";

import { FontInfo, GeneralConfig, GENERAL_CONFIG } from "./config/Config";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase";
import { Tab } from "./Tab";
import { Terminal } from "./terminal/Terminal";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig";
import { ThemeManager } from "./theme/ThemeManager";
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager";
import { qKeyEventToMinimalKeyboardEvent } from "./keybindings/QKeyEventUtilities";
import { UiStyle } from "./ui/UiStyle";
import { CachingLigatureMarker, LigatureMarker } from "./CachingLigatureMarker";


export class Window {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;

  #windowWidget: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;

  #tabs: Tab[] = [];
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

    this.onTabCloseRequest = this.#onTabCloseRequestEventEmitter.event;
    this.onTabChange = this.#onTabChangeEventEmitter.event;
  }

  async init(): Promise<void> {
    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
    this.#configDatabase.onChange((event: ConfigChangeEvent) => this.#handleConfigChangeEvent(event));

    this.#windowWidget = Widget({
      windowTitle: "Extraterm Qt",
      focusPolicy: FocusPolicy.ClickFocus,
      cssClass: ["window-background"],
      onKeyPress: (nativeEvent) => {
        this.#handleKeyPress(new QKeyEvent(nativeEvent));
      },
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [0, 11, 0, 0],
        spacing: 0,
        children: [
          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              spacing: 0,
              children: [
                {widget:
                  this.#tabBar = TabBar({
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
                  }), stretch: 1},

                {widget: Widget({
                  cssClass: ["tabbar-gap"],
                  layout: BoxLayout({
                    direction: Direction.LeftToRight,
                    contentsMargins: [0, 0, 0, 0],
                    spacing: 0,
                    children: [
                      {widget: this.#createHamburgerMenu(this.#uiStyle), stretch: 0}
                    ]
                  })
                }), stretch: 0}
              ]
            })
          }),
          this.#contentStack = StackedWidget({children: []})
        ]
      })
    });
    this.#windowWidget.resize(800, 480);
  }

  #createHamburgerMenu(uiStyle: UiStyle): QToolButton {
    const hamburgerMenuIcon = uiStyle.getHamburgerMenuIcon();
    const hamburgerMenuIconHover = uiStyle.getHamburgerMenuIconHover();

    this.#hamburgerMenuButton = ToolButton({
      icon: hamburgerMenuIcon,
      popupMode: ToolButtonPopupMode.InstantPopup,
      onEnter: () => {
        this.#hamburgerMenuButton.setIcon(hamburgerMenuIconHover);
      },
      onLeave: () => {
        this.#hamburgerMenuButton.setIcon(hamburgerMenuIcon);
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

    this.#hamburgerMenu.clear();
    const entries = this.#extensionManager.queryCommands(options);
    if (entries.length === 0) {
      return;
    }

    let category = entries[0].category;
    for (const entry of entries) {
      if (entry.category !== category) {
        this.#hamburgerMenu.addSeparator();
        category = entry.category;
      }
      const action = this.#hamburgerMenu.addAction(entry.title);
      action.setData(new QVariant(entry.command));
      if (entry.icon != null) {
        const icon = uiStyle.getMenuIcon(entry.icon);
        if (icon != null) {
          action.setIcon(icon);
        }
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

  #handleTabBarChanged(index: number): void {
    if (index < 0 || index >= this.#tabs.length) {
      return;
    }
    this.setCurrentTabIndex(index);
  }

  #handleTabBarCloseClicked(index: number): void {
    this.#onTabCloseRequestEventEmitter.fire(this.#tabs[index]);
  }

  #handleKeyPress(event: QKeyEvent): void {
    const ev = qKeyEventToMinimalKeyboardEvent(event);
    const commands = this.#keybindingsIOManager.mapEventToCommands(ev);
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
      const plainlLigatureMarker = await loadFontFile(fontInfo.path);
      if (plainlLigatureMarker != null) {
        ligatureMarker = new CachingLigatureMarker(plainlLigatureMarker);
      }
    }

    const transparentBackground = config.windowBackgroundMode !== "opaque";
    const fontMetrics = computeFontMetrics(fontInfo.family, fontInfo.style, config.terminalFontSize);

    const extraFonts: FontSlice[] = [
      {
        fontFamily: "twemoji",
        fontSizePx: 16,
        unicodeStart: 0x1f000,
        unicodeEnd: 0x20000,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ];
    const extraFontMetrics = extraFonts.map(
      (extraFont) => computeEmojiMetrics(fontMetrics, extraFont.fontFamily, extraFont.fontSizePx));

    const terminalVisualConfig: TerminalVisualConfig = {
      cursorStyle: config.cursorStyle,
      cursorBlink: config.blinkingCursor,
      fontInfo,
      fontSizePx: config.terminalFontSize,
      fontMetrics,
      extraFontMetrics,
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

  async #handleConfigChangeEvent(event: ConfigChangeEvent): Promise<void> {
    if (event.key !== GENERAL_CONFIG) {
      return;
    }
    const oldConfig = <GeneralConfig> event.oldConfig;
    const newConfig = <GeneralConfig> event.newConfig;

    if (oldConfig.terminalFont === newConfig.terminalFont &&
        oldConfig.terminalFontSize === newConfig.terminalFontSize &&
        oldConfig.cursorStyle === newConfig.cursorStyle &&
        oldConfig.themeTerminal === newConfig.themeTerminal &&
        oldConfig.terminalDisplayLigatures === newConfig.terminalDisplayLigatures &&
        oldConfig.terminalMarginStyle === newConfig.terminalMarginStyle) {
      return;
    }

    this.#terminalVisualConfig = await this.#createTerminalVisualConfig();
    for (const tab of this.#tabs) {
      if (tab instanceof Terminal) {
        tab.setTerminalVisualConfig(this.#terminalVisualConfig);
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
  }

  isActiveWindow(): boolean {
    return this.#windowWidget.isActiveWindow();
  }

  getWidget(): QWidget {
    return this.#windowWidget;
  }

  setCurrentTabIndex(index: number): void {
    const currentIndex = this.getCurrentTabIndex();
    this.#tabs[currentIndex].unfocus();

    this.#tabBar.setCurrentIndex(index);
    this.#contentStack.setCurrentIndex(index);
    this.#tabs[index].focus();

    this.#onTabChangeEventEmitter.fire(this.#tabs[index]);
  }

  getCurrentTabIndex(): number {
    return this.#tabBar.currentIndex();
  }

  getTabCount(): number {
    return this.#tabs.length;
  }

  getTab(index: number): Tab {
    return this.#tabs[index];
  }

  addTab(tab: Tab): void {
    if (this.#tabs.includes(tab)) {
      return;
    }

    this.#tabs.push(tab);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
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
      if (targetTab === tab) {
        this.#tabBar.removeTab(index);
        this.#contentStack.removeWidget(tab.getContents());
        this.#tabs.splice(index, 1);

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
    const index = this.#tabs.indexOf(tab);
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
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
