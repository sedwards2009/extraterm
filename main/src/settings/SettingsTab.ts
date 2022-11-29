/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QStackedWidget, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ListWidget, ListWidgetItem, StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";
import { Event } from "@extraterm/extraterm-extension-api";
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
import { SettingsPageType } from "./SettingsPageType.js";
import { ExtensionHolderPage } from "./ExtensionHolderPage.js";


export class SettingsTab implements Tab {
  private _log: Logger = null;

  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #themeManager: ThemeManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #terminalVisualConfig: TerminalVisualConfig = null;
  #parent: any = null;
  #uiStyle: UiStyle = null;
  #fontAtlasCache: FontAtlasCache = null;
  #window: Window = null;

  #pages: SettingsPageType[] = [];

  #contentWidget: QWidget = null;

  #onWindowTitleChangedEventEmitter = new EventEmitter<string>();
  onWindowTitleChanged: Event<string> = null;

  #pageToStackMapping = new Map<number, number>();
  #stackedWidgetCount = 0;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager,
    keybindingsIOManager: KeybindingsIOManager, window: Window, uiStyle: UiStyle, fontAtlasCache: FontAtlasCache) {

    this._log = getLogger("SettingsTab", this);
    this.onWindowTitleChanged = this.#onWindowTitleChangedEventEmitter.event;
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;
    this.#window = window;
    this.#fontAtlasCache = fontAtlasCache;

    this.#pages = this.#createPages();
    this.#createUI(uiStyle);
  }

  #createPages(): SettingsPageType[] {
    const result: SettingsPageType[] =  [];
    result.push(new GeneralPage(this.#configDatabase, this.#uiStyle));
    result.push(new AppearancePage(this.#configDatabase, this.#extensionManager, this.#themeManager,
      this.#uiStyle, this.#fontAtlasCache));
    result.push(new SessionTypesPage(this.#configDatabase, this.#extensionManager, this.#window, this.#uiStyle));
    result.push(new KeybindingsPage(this.#configDatabase, this.#extensionManager, this.#keybindingsIOManager,
      this.#uiStyle));
    result.push(new FramesPage(this.#configDatabase, this.#uiStyle));
    result.push(new ExtensionsPage(this.#extensionManager, this.#uiStyle));

    for (const contrib of this.#extensionManager.getSettingsTabContributions()) {
      result.push(new ExtensionHolderPage(contrib, this.#uiStyle));
    }
    return result;
  }

  dispose(): void {
  }

  setParent(parent: any): void {
    this.#parent = parent;
  }

  getParent(): any {
    return this.#parent;
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

  getWindowTitle(): string {
    return "Extraterm Qt - Settings";
  }

  setWindowTitle(title: string): void {
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;
    for (const page of this.#pages) {
      if (hasSetTerminalVisualConfig(page)) {
        page.setTerminalVisualConfig(this.#terminalVisualConfig);
      }
    }
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
              items: this.#pages.map((p, index) =>
                ListWidgetItem({
                  icon: uiStyle.getSettingsMenuIcon(p.getIconName()),
                  text: p.getMenuText(),
                  selected: index === 0
                })
              ),
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
    return this.#pages[index].getPage();
  }
}

interface TerminalVisualConfigSetter {
  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void;
}

function hasSetTerminalVisualConfig(page: any): page is TerminalVisualConfigSetter {
  return page["setTerminalVisualConfig"] !== undefined;
}
