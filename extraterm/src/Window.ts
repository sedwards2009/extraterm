/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { computeFontMetrics } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { doLater } from "extraterm-later";
import { Direction, QStackedWidget, QTabBar, QWidget, QBoxLayout, QToolButton, ToolButtonPopupMode, QMenu, QVariant, QAction } from "@nodegui/nodegui";
import { FontInfo } from "./config/Config";
import { ConfigDatabase } from "./config/ConfigDatabase";
import { Tab } from "./Tab";
import { Terminal } from "./terminal/Terminal";
import { TerminalVisualConfig } from "./terminal/TerminalVisualConfig";
import { ThemeManager } from "./theme/ThemeManager";
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { CommandQueryOptions, ExtensionManager } from "./InternalTypes";


export class Window {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;

  #windowWidget: QWidget = null;
  #tabBarContainerWidget: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;

  #hamburgerMenuButton: QToolButton = null;
  #hamburgerMenu: QMenu = null;

  #tabs: Tab[] = [];
  #terminalVisualConfig: TerminalVisualConfig = null;
  #themeManager: ThemeManager = null;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager) {
    this._log = getLogger("Window", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;
    this.#windowWidget = new QWidget();
    this.#windowWidget.setWindowTitle("Extraterm Qt");
    this.#windowWidget.resize(800, 480);

    this.#terminalVisualConfig = this.#createTerminalVisualConfig();

    const topLayout = new QBoxLayout(Direction.TopToBottom, this.#windowWidget);
    topLayout.setContentsMargins(0, 11, 0, 0);
    topLayout.setSpacing(0);

    this.#tabBarContainerWidget = new QWidget();

    const tabBarLayout = new QBoxLayout(Direction.LeftToRight, this.#tabBarContainerWidget);
    tabBarLayout.setContentsMargins(0, 0, 0, 0);
    this.#tabBar = this.#createTabBar();
    tabBarLayout.addWidget(this.#tabBar, 1);
    tabBarLayout.addWidget(this.#createHamburgerMenu(), 0);

    topLayout.addWidget(this.#tabBarContainerWidget);

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
      this.#extensionManager.executeCommand(commandName);
    });
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

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
