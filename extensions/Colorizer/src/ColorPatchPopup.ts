/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  Logger,
  TerminalSettings
} from "@extraterm/extraterm-extension-api";
import { BoxLayout, GridLayout, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { Direction, QColor, QPushButton, QSizePolicyPolicy, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { ColorPatchButton } from "./ColorPatchButton";

const NUMBER_OF_COLORS = 16;


export class ColorPatchPopup {

  #onSelectedEventEmitter = new EventEmitter<number>();
  onSelected: Event<number> = null;

  #onClosedEventEmitter = new EventEmitter<void>();
  onClosed: Event<void> = null;

  #popup: QWidget = null;
  #patches: ColorPatchButton[] = [];
  #noneButton: QPushButton = null;

  constructor(terminalSettings: TerminalSettings, log: Logger) {
    this.onSelected = this.#onSelectedEventEmitter.event;
    this.onClosed = this.#onClosedEventEmitter.event;

    for (let i=0; i<NUMBER_OF_COLORS; i++) {
      const colorIndex = i;
      const patch = new ColorPatchButton(true, log);
      patch.onClicked(() => {
        this.#onSelectedEventEmitter.fire(colorIndex);
      });
      patch.setColor(new QColor(terminalSettings.currentTheme[i]));
      this.#patches.push(patch);
    }

    this.#popup = Widget({
      cssClass: ["window-background"],
      windowFlag: WindowType.Popup,
      contentsMargins: 0,
      attribute: [
        WidgetAttribute.WA_WindowPropagation,
        WidgetAttribute.WA_X11NetWmWindowTypePopupMenu,
        WidgetAttribute.WA_TranslucentBackground
      ],
      sizePolicy: {
        vertical: QSizePolicyPolicy.Minimum,
        horizontal: QSizePolicyPolicy.Minimum,
      },
      onClose: () => {
        this.#onClosedEventEmitter.fire();
      },

      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          {
            layout: GridLayout({
              columns: 8,
              spacing: 0,
              contentsMargins: [0, 0, 0, 0],
              children: this.#patches.map(p => p.getWidget())
            }),
            stretch: 0
          },

          this.#noneButton = PushButton({
            text: "None",
            cssClass: ["small"],
            checkable: true,
            onClicked: () => {
              this.#onSelectedEventEmitter.fire(null);
            }
          })
        ]
      }),
    });
  }

  getWidget(): QWidget {
    return this.#popup;
  }

  setSelectedIndex(index: number): void {
    for (let i=0; i<NUMBER_OF_COLORS; i++) {
      this.#patches[i].getWidget().setChecked(i === index);
    }
    this.#noneButton.setChecked(index == null);
  }
}