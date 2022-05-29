/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QScrollArea, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, GridLayout, Label, ScrollArea, SpinBox, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { UiStyle } from "../ui/UiStyle.js";
import { createHtmlIcon } from "../ui/Icons.js";
import { makeGroupLayout, shrinkWrap } from "../ui/QtConstructExtra.js";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { GeneralConfig, MouseButtonAction } from "../config/Config.js";


export class GeneralPage {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle) {
    this._log = getLogger("GeneralPage", this);
    this.#configDatabase = configDatabase;
  }

  getPage(): QScrollArea {
    const updateGeneralConfig = (func: (generalConfig: GeneralConfig) => void): void => {
      const generalConfig = this.#configDatabase.getGeneralConfigCopy();
      func(generalConfig);
      this.#configDatabase.setGeneralConfig(generalConfig);
    };
    const config = this.#configDatabase.getGeneralConfig();

    return ScrollArea({
      cssClass: "settings-tab",
      widgetResizable: true,

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
                    maximum: 1000000,
                    value: config.scrollbackMaxLines,
                    onValueChanged: (lines: number) => {
                      updateGeneralConfig((generalConfig: GeneralConfig) => {
                        generalConfig.scrollbackMaxLines = lines;
                      });
                    }
                  }),
                  "lines",
                ),

                "Max. Scrollback Frames:",
                makeGroupLayout(
                  SpinBox({
                    minimum: 0,
                    maximum: 10000,
                    value: config.scrollbackMaxFrames,
                    onValueChanged: (frames: number) => {
                      updateGeneralConfig((generalConfig: GeneralConfig) => {
                        generalConfig.scrollbackMaxFrames = frames;
                      });
                    }
                  }),
                  "frames"
                ),

                "",
                CheckBox({
                  checkState: config.autoCopySelectionToClipboard,
                  text: "Automatically copy selection to clipboard",
                  onStateChanged: (state: number) => {
                    updateGeneralConfig((generalConfig: GeneralConfig) => {
                      generalConfig.autoCopySelectionToClipboard = state !== 0;
                    });
                  }
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
            }),
            {stretch: 1, widget: Widget({}) }
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
