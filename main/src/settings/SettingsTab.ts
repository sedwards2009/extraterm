/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Direction, QBoxLayout, QScrollArea, QStackedWidget, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, ComboBoxItem, GridLayout, Label, ListWidget, ListWidgetItem, ScrollArea, SpinBox,
  StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Tab } from "../Tab";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { GeneralConfig } from "../config/Config";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { makeGroupLayout } from "../ui/QtConstructExtra";


export class SettingsTab implements Tab {
  private _log: Logger = null;

  #contentWidget: QWidget = null;
  #contentLayout: QBoxLayout = null;
  #configDatabase: ConfigDatabase = null;

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle) {
    this._log = getLogger("SettingsTab", this);
    this.#configDatabase = configDatabase;
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
                // ListWidgetItem({text: "Session Types"}),
                // ListWidgetItem({text: "Keybindings"}),
                // ListWidgetItem({text: "Frames"}),
                // ListWidgetItem({text: "Extensions"}),
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
                this.#createGeneralPage(),
                this.#createAppearancePage()
              ]}),
            stretch: 1,
          }
        ]
      })
    });
  }

  #createGeneralPage(): QScrollArea {
    return ScrollArea({
      cssClass: "settings-tab",

      widget: Widget({
        cssClass: "settings-tab",
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-sliders-h")}&nbsp;&nbsp;General Settings`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]}),
            GridLayout({
              columns: 2,
              children: [
                "Show Tips:",
                ComboBox({items: ["Every time", "Daily", "Never"]}),

                "Max. Scrollback Lines:",
                makeGroupLayout(
                  SpinBox({
                    minimum: 0,
                    maximum: 10000,
                    value: 1000
                  }),
                  "lines"
                ),

                "Max. Scrollback Frames:",
                makeGroupLayout(
                  SpinBox({
                    minimum: 0,
                    maximum: 10000,
                    value: 1000
                  }),
                  "frames"
                ),

                "",
                CheckBox({
                  checkState: true,
                  text: "Automatically copy selection to clipboard"
                }),

                "",
                CheckBox({
                  checkState: true,
                  text: "Close the window after closing the last tab"
                }),
              ]
            })
          ]
        })
      })
    });
  }

  #createAppearancePage(): QScrollArea {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    const systemConfig = this.#configDatabase.getSystemConfig();

    const allFonts = systemConfig.availableFonts;
    const currentFontIndex = allFonts.map(f => f.id).indexOf( generalConfig.terminalFont);

    const update = (mutator: (config: GeneralConfig) => void): void => {
      const generalConfig = this.#configDatabase.getGeneralConfigCopy();
      mutator(generalConfig);
      this.#configDatabase.setGeneralConfig(generalConfig);
    };

    return ScrollArea({
      cssClass: "settings-tab",
      widget: Widget({
        cssClass: "settings-tab",
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-paint-brush")}&nbsp;&nbsp;Appearance`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]}),
            GridLayout({
              columns: 2,
              children: [
                "Font:",
                ComboBox({
                  currentIndex: currentFontIndex,
                  items: allFonts.map((f): ComboBoxItem => ({ text: f.name, userData: f.id }))
                }),

                "Font Size:",
                makeGroupLayout(
                  SpinBox({
                    minimum: 1,
                    maximum: 1024,
                    value: generalConfig.terminalFontSize,
                    onValueChanged: (value: number) => {
                      update((c) => c.terminalFontSize = value);
                    },
                  }),
                  "pixels"
                )
              ]
            })
          ]}
        )
      })
    });
  }
}
