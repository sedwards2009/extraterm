/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QStackedWidget, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ListWidget, ListWidgetItem, StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Tab } from "../Tab";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { UiStyle } from "../ui/UiStyle";
import { GeneralPage } from "./GeneralPage";
import { AppearancePage } from "./AppearancePage";
import { ExtensionsPage } from "./ExtensionsPage";
import { FramesPage } from "./FramesPage";
import { ExtensionManager } from "../InternalTypes";
import { ThemeManager } from "../theme/ThemeManager";
import { SessionTypesPage } from "./SessionTypesPage";


export class SettingsTab implements Tab {
  private _log: Logger = null;

  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #themeManager: ThemeManager = null;

  #generalPage: GeneralPage = null;
  #appearancePage: AppearancePage = null;
  #sessionTypesPage: SessionTypesPage = null;
  #framesPage: FramesPage = null;
  #extensionsPage: ExtensionsPage = null;

  #contentWidget: QWidget = null;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager, themeManager: ThemeManager,
      uiStyle: UiStyle) {

    this._log = getLogger("SettingsTab", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#themeManager = themeManager;

    this.#generalPage = new GeneralPage(this.#configDatabase, uiStyle);
    this.#appearancePage = new AppearancePage(this.#configDatabase, this.#extensionManager, this.#themeManager,
      uiStyle);
    this.#sessionTypesPage = new SessionTypesPage(this.#configDatabase, this.#extensionManager, uiStyle);
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

  getContents(): QWidget {
    return this.#contentWidget;
  }

  focus(): void {
    this.#contentWidget.setFocus();
  }

  unfocus(): void {
  }

  #createUI(uiStyle: UiStyle): void {
    let stackedWidget: QStackedWidget = null;

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
                // ListWidgetItem({text: "Keybindings"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-window-maximize"), text: "Frames"}),
                ListWidgetItem({icon: uiStyle.getSettingsMenuIcon("fa-puzzle-piece"), text: "Extensions"}),
              ],
              currentRow: 0,
              onCurrentRowChanged: (row) => {
                stackedWidget.setCurrentIndex(row);
              }
            }),
            stretch: 0,
          },
          {widget:
            stackedWidget = StackedWidget({
              cssClass: ["settings-stack"],
              children: [
                this.#generalPage.getPage(),
                this.#appearancePage.getPage(),
                this.#sessionTypesPage.getPage(),
                this.#framesPage.getPage(),
                this.#extensionsPage.getPage(),
              ]
            }),
            stretch: 1,
          }
        ]
      })
    });
  }
}
