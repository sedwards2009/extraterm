/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QStackedWidget, QTabBar, QWidget, QBoxLayout } from "@nodegui/nodegui";
import { FontInfo } from "./config/Config";
import { ConfigDatabase } from "./config/ConfigDatabase";
import { Tab } from "./Tab";
import { Terminal } from "./terminal/Terminal";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig";
import { ThemeManager } from "./theme/ThemeManager";


export class Window {
  #configDatabase: ConfigDatabase = null;
  #windowWidget: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;

  #tabs: Tab[] = [];
  #terminalVisualConfig: TerminalVisualConfig = null;
  #themeManager: ThemeManager = null;

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager) {
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
    this.#windowWidget = new QWidget();
    this.#windowWidget.setWindowTitle("Extraterm Qt");

    this.#terminalVisualConfig = this.#createTerminalVisualConfig();

    const topLayout = new QBoxLayout(Direction.TopToBottom, this.#windowWidget);

    this.#tabBar = this.#createTabBar();

    topLayout.addWidget(this.#tabBar);

    this.#contentStack = new QStackedWidget();
    topLayout.addWidget(this.#contentStack);
  }

  #createTabBar(): QTabBar {
    const tabbarContainer = new QWidget();
    const tabbarContainerLayout = new QBoxLayout(Direction.LeftToRight, tabbarContainer);
    const tabBar = new QTabBar();
    tabbarContainerLayout.addWidget(tabBar);

    return tabBar;
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

    const terminalVisualConfig: TerminalVisualConfig = {
      cursorStyle: config.cursorStyle,
      cursorBlink: config.blinkingCursor,
      fontInfo,
      fontSizePx: config.terminalFontSize,
      terminalTheme,
      transparentBackground: config.windowBackgroundMode !== "opaque",
      useLigatures: config.terminalDisplayLigatures,
      // ligatureMarker: null,
      screenHeightHintPx: 1024, // FIXME
      screenWidthHintPx: 1024,  // FIXME
    };
    return terminalVisualConfig;
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

  addTab(tab: Tab): void {
    this.#tabs.push(tab);

    if (tab instanceof Terminal) {
      tab.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    const header = tab.getTitle();
    this.#tabBar.addTab(null, header);

    this.#contentStack.addWidget(tab.getContents());
  }
}