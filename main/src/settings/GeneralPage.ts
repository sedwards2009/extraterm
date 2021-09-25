/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QScrollArea, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, CheckBox, ComboBox, GridLayout, Label, ScrollArea, SpinBox, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { makeGroupLayout } from "../ui/QtConstructExtra";


export class GeneralPage {
  private _log: Logger = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("GeneralPage", this);
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
}
