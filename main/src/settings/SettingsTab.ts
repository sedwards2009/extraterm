/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QStackedWidget, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ListWidget, ListWidgetItem, StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Tab } from "../Tab.js";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { UiStyle } from "../ui/UiStyle.js";
import { GeneralPage } from "./GeneralPage.js";
import { AppearancePage } from "./AppearancePage.js";
import { ExtensionsPage } from "./ExtensionsPage.js";
import { FramesPage } from "./FramesPage.js";
import { ExtensionManager } from "../InternalTypes.js";
import { ThemeManager } from "../theme/ThemeManager.js";
import { SessionTypesPage } from "./SessionTypesPage.js";
import { KeybindingsPage } from "./keybindings/KeybindingsPage.js";
import { KeybindingsIOManager } from "../keybindings/KeybindingsIOManager.js";
import { Window } from "../Window.js";
import { TerminalVisualConfig } from "../terminal/TerminalVisualConfig.js";
import { FontAtlasCache } from "../terminal/FontAtlasCache.js";


export class SettingsTab implements Tab {
  private _log: Logger = null;

  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #themeManager: ThemeManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #terminalVisualConfig: TerminalVisualConfig = null;

  #generalPage: GeneralPage = null;
  #appearancePage: AppearancePage = null;
  #sessionTypesPage: SessionTypesPage = null;
  #keybindingsPage: KeybindingsPage = null;
  #framesPage: FramesPage = null;
  #extensionsPage: ExtensionsPage = null;
  #contentWidget: QWidget = null;

  #pageToStackMapping = new Map<number, number>();
  #stackedWidgetCount = 0;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager,
    keybindingsIOManager: KeybindingsIOManager, window: Window, uiStyle: UiStyle, fontAtlasCache: FontAtlasCache) {

    this._log = getLogger("SettingsTab", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;
    this.#keybindingsIOManager = keybindingsIOManager;

    this.#generalPage = new GeneralPage(this.#configDatabase, uiStyle);
    this.#appearancePage = new AppearancePage(this.#configDatabase, this.#extensionManager, this.#themeManager,
      uiStyle, fontAtlasCache);
    this.#sessionTypesPage = new SessionTypesPage(this.#configDatabase, this.#extensionManager, window, uiStyle);
    this.#keybindingsPage = new KeybindingsPage(this.#configDatabase, this.#extensionManager,
      this.#keybindingsIOManager, uiStyle);
    this.#framesPage = new FramesPage(configDatabase, uiStyle);
    this.#extensionsPage = new ExtensionsPage(this.#extensionManager, uiStyle);
    this.#createUI(uiStyle);
  }

  getTitle(): string {
    return "Settings";
  }

  getIconName(): string {
    return "extraicons-pocketknife";
  }

  getTabWidget(): QWidget {
    return null;
  }

  getContents(): QWidget {
    return this.#contentWidget;
  }

  setIsCurrent(isCurrent: boolean): void {
  }

  focus(): void {
    this.#contentWidget.setFocus();
  }

  unfocus(): void {
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;
    this.#appearancePage.setTerminalVisualConfig(this.#terminalVisualConfig);
  }

  #createUI(uiStyle: UiStyle): void {
    let stackedWidget: QStackedWidget = null;

    const showPage = (row: number): void => {
      if (!this.#pageToStackMapping.has(row)) {
        stackedWidget.addWidget(this.#createPage(row));
        this.#pageToStackMapping.set(row, this.#stackedWidgetCount);
        this.#stackedWidgetCount++;
      }
      stackedWidget.setCurrentIndex(this.#pageToStackMapping.get(row));
    };

    this.#contentWidget = Widget({
      cssClass: "background",
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        spacing: 0,
        contentsMargins: [0, 0, 0, 0],
        children: [
          {widget:
            ListWidget({
              cssClass: ["settings-menu"],
              items: [
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-sliders-h"), text: "General", selected: true}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-paint-brush"), text: "Appearance"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-terminal"), text: "Session Types"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-keyboard"), text: "Keybindings"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-window-maximize"), text: "Frames"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-puzzle-piece"), text: "Extensions"}),
              ],
              currentRow: 0,
              onCurrentRowChanged: (row) => {
                showPage(row);
              }
            }),
            stretch: 0,
          },
          {widget:
            stackedWidget = StackedWidget({
              cssClass: ["settings-stack"],
              children: []
            }),
            stretch: 1,
          }
        ]
      })
    });
    showPage(0);
  }

  #createPage(index: number): QWidget {
    switch (index) {
      case 0:
        return this.#generalPage.getPage();
      case 1:
        return this.#appearancePage.getPage();
      case 2:
        return this.#sessionTypesPage.getPage();
      case 3:
        return this.#keybindingsPage.getPage();
      case 4:
        return this.#framesPage.getPage();
      default:
        return this.#extensionsPage.getPage();
    }
  }
}
