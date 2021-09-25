/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QComboBox, QScrollArea, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, ComboBoxItem, GridLayout, Label, PushButton, ScrollArea, SpinBox,
  Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { GeneralConfig } from "../config/Config";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { makeGroupLayout } from "../ui/QtConstructExtra";
import { ThemeManager } from "../theme/ThemeManager";


export class AppearancePage {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #uiStyle: UiStyle = null;

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager, uiStyle: UiStyle) {
    this._log = getLogger("AppearancePage", this);
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;
  }

  getPage(): QScrollArea {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    const systemConfig = this.#configDatabase.getSystemConfig();

    const allFonts = systemConfig.availableFonts;
    const currentFontIndex = allFonts.map(f => f.id).indexOf( generalConfig.terminalFont);

    const update = (mutator: (config: GeneralConfig) => void): void => {
      const generalConfig = this.#configDatabase.getGeneralConfigCopy();
      mutator(generalConfig);
      this.#configDatabase.setGeneralConfig(generalConfig);
    };

    let themeCombo: QComboBox = null;
    
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
                ),

                "Theme:",
                themeCombo = ComboBox({
                  currentIndex: 0,
                  items: this.#getTerminalThemeItems(),
                }),

                "Cursor Style:",
                makeGroupLayout(
                  PushButton({
                    text: "\u{2588}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "block",
                    onClicked: () => { update(config => config.cursorStyle = "block"); }
                  }),
                  PushButton({
                    text: "\u{2582}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "underscore",
                    onClicked: () => { update(config => config.cursorStyle = "underscore"); }
                  }),
                  PushButton({
                    text: "\u{2503}",
                    cssClass: ["small"],
                    checkable: true,
                    autoExclusive: true,
                    checked: generalConfig.cursorStyle === "beam",
                    onClicked: () => { update(config => config.cursorStyle = "beam"); }
                  }),
                )
              ]
            })
          ]}
        )
      })
    }); 
  }

  #getTerminalThemeItems(): ComboBoxItem[] {
    return this.#themeManager.getAllThemes().filter(theme => theme.type === "terminal")
      .map((theme): ComboBoxItem => ({ text: theme.name, userData: theme.id }));
  }
}
