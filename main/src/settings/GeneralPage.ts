/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QScrollArea, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, GridLayout, Label, ScrollArea, SpinBox, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { makeGroupLayout, shrinkWrap } from "../ui/QtConstructExtra";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { GeneralConfig, MouseButtonAction } from "../config/Config";


export class GeneralPage {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle) {
    this._log = getLogger("GeneralPage", this);
    this.#configDatabase = configDatabase;
  }

  getPage(): QScrollArea {
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
                shrinkWrap(ComboBox({items: ["Every time", "Daily", "Never"]})),

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

                {widget: Label({text: "Mouse Button Actions", cssClass: "h3"}), colSpan: 2},

                "Middle:",
                this.#makeMouseOption("middleMouseButtonAction"),

                "Middle + Shift:",
                this.#makeMouseOption("middleMouseButtonShiftAction"),

                "Middle + Control:",
                this.#makeMouseOption("middleMouseButtonControlAction"),

                "Right:",
                this.#makeMouseOption("rightMouseButtonAction"),

                "Right + Shift:",
                this.#makeMouseOption("rightMouseButtonShiftAction"),

                "Right + Control:",
                this.#makeMouseOption("rightMouseButtonControlAction"),
              ]
            })
          ]
        })
      })
    });
  }

  #makeMouseOption(key: keyof GeneralConfig): QBoxLayout {
    const config = this.#configDatabase.getGeneralConfig();

    const isLinux = process.platform === "linux";
    const comboValues: MouseButtonAction[] = ["none", "paste"];
    if (isLinux) {
      comboValues.push("paste_selection");
    }
    comboValues.push("context_menu");

    return shrinkWrap(ComboBox({
      items: [
        "None",
        "Paste from Clipboard",
        isLinux ? "Paste from Selection Clipboard" : null,
        "Context Menu",
      ],
      currentIndex: comboValues.indexOf(<MouseButtonAction> config[key]),
      onActivated: (index) => {
        const generalConfig = this.#configDatabase.getGeneralConfigCopy();
        (<any> generalConfig)[key] = comboValues[index];
        this.#configDatabase.setGeneralConfig(generalConfig);
      }
    }));
  }
}
