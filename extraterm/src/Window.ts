/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { computeFontMetrics } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-later";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QStackedWidget, QTabBar, QWidget, QBoxLayout, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction, FocusPolicy, WidgetEventTypes, QKeyEvent } from "@nodegui/nodegui";

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


export class Window {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;

  #windowWidget: QWidget = null;
  #tabBarContainerWidget: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;

  #tabs: Tab[] = [];
  #terminalVisualConfig: TerminalVisualConfig = null;
  #themeManager: ThemeManager = null;

  onTabCloseRequest: Event<Tab> = null;
  #onTabCloseRequestEventEmitter = new EventEmitter<Tab>();

  onTabChange: Event<Tab> = null;
  #onTabChangeEventEmitter = new EventEmitter<Tab>();

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager,
      keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager) {

    this._log = getLogger("Window", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#themeManager = themeManager;

    this.onTabCloseRequest = this.#onTabCloseRequestEventEmitter.event;
    this.onTabChange = this.#onTabChangeEventEmitter.event;

    this.#windowWidget = new QWidget();
    this.#windowWidget.setWindowTitle("Extraterm Qt");
    this.#windowWidget.setFocusPolicy(FocusPolicy.ClickFocus);
    this.#windowWidget.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });

    this.#windowWidget.resize(800, 480);

    this.#terminalVisualConfig = this.#createTerminalVisualConfig();
    this.#configDatabase.onChange((event: ConfigChangeEvent) => this.#handleConfigChangeEvent(event));

    const topLayout = new QBoxLayout(Direction.TopToBottom, this.#windowWidget);
    topLayout.setContentsMargins(0, 11, 0, 0);
    topLayout.setSpacing(0);

    this.#tabBarContainerWidget = new QWidget();

    const tabBarLayout = new QBoxLayout(Direction.LeftToRight, this.#tabBarContainerWidget);
    tabBarLayout.setContentsMargins(0, 0, 0, 0);

    const tabbarContainer = new QWidget();
    const tabbarContainerLayout = new QBoxLayout(Direction.LeftToRight, tabbarContainer);
    this.#tabBar = new QTabBar();
    this.#tabBar.addEventListener("currentChanged", (index: number) => {
      this.#handleTabBarChanged(index);
    });

    this.#tabBar.setTabsClosable(true);
    this.#tabBar.addEventListener("tabCloseRequested", (index: number) => {
      this.#handleTabBarCloseClicked(index);
    });

    tabbarContainerLayout.addWidget(this.#tabBar);

    tabBarLayout.addWidget(this.#tabBar, 1);
    tabBarLayout.addWidget(this.#createHamburgerMenu(), 0);

    topLayout.addWidget(this.#tabBarContainerWidget);

    this.#contentStack = new QStackedWidget();
    topLayout.addWidget(this.#contentStack);
  }

  #createHamburgerMenu(): QToolButton {
    this.#hamburgerMenuButton = new QToolButton();
    this.#hamburgerMenuButton.setText("=");
    this.#hamburgerMenuButton.setPopupMode(ToolButtonPopupMode.InstantPopup);

    this.#hamburgerMenu = new QMenu();
    this.#hamburgerMenuButton.setMenu(this.#hamburgerMenu);
    this.#hamburgerMenu.addEventListener("triggered", (nativeAction) => {
      const action = new QAction(nativeAction);
      this.#handleWindowMenuTriggered(action.data().toString());
    });
    this.#updateHamburgerMenu();

    return this.#hamburgerMenuButton;
  }

  #updateHamburgerMenu(): void {
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

  #createTerminalVisualConfig(): TerminalVisualConfig {
    const config = this.#configDatabase.getGeneralConfig();
    const fontInfo = this.#getFontInfo(config.terminalFont);
    const terminalTheme = this.#themeManager.getTerminalTheme(config.themeTerminal);

    // let ligatureMarker: LigatureMarker = null;
    // if (config.terminalDisplayLigatures) {
    //   const plainlLigatureMarker = await loadFontFile(fontFilePath);
    //   if (plainlLigatureMarker != null) {
    //     ligatureMarker = new CachingLigatureMarker(plainlLigatureMarker);
    //   }
    // }
    const transparentBackground = config.windowBackgroundMode !== "opaque";
    const fontMetrics = computeFontMetrics(fontInfo.family, fontInfo.style, config.terminalFontSize);
    const terminalVisualConfig: TerminalVisualConfig = {
      cursorStyle: config.cursorStyle,
      cursorBlink: config.blinkingCursor,
      fontInfo,
      fontSizePx: config.terminalFontSize,
      fontMetrics,
      palette: this.#extractPalette(terminalTheme, transparentBackground),
      terminalTheme,
      transparentBackground,
      useLigatures: config.terminalDisplayLigatures,
      // ligatureMarker: null,
      screenHeightHintPx: 1024, // FIXME
      screenWidthHintPx: 1024,  // FIXME
    };
    return terminalVisualConfig;
  }

  #handleConfigChangeEvent(event: ConfigChangeEvent): void {
    if (event.key !== GENERAL_CONFIG) {
      return;
    }
    const oldConfig = <GeneralConfig> event.oldConfig;
    const newConfig = <GeneralConfig> event.newConfig;

    if (oldConfig.terminalFont === newConfig.terminalFont &&
        oldConfig.terminalFontSize === newConfig.terminalFontSize) {
      return;
    }

    this.#terminalVisualConfig = this.#createTerminalVisualConfig();
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
    this.#tabs.push(tab);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    const header = tab.getTitle();
    this.#tabBar.addTab(null, header);

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
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
