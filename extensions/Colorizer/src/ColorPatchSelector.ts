/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  Logger,
  TerminalTheme,
} from "@extraterm/extraterm-extension-api";
import { Direction, QColor, QPoint, QSizePolicyPolicy, QWidget } from "@nodegui/nodegui";
import { EventEmitter } from "extraterm-event-emitter";
import { BoxLayout, Frame, Label, Widget } from "qt-construct";
import { ColorPatchButton } from "./ColorPatchButton";
import { ColorPatchPopup } from "./ColorPatchPopup";


export class ColorPatchSelector {

  #onChangedEventEmitter = new EventEmitter<number>();
  onChanged: Event<number> = null;

  #terminalTheme: TerminalTheme = null;

  #colorPatchButton: ColorPatchButton = null;
  #colorPatchPopup: ColorPatchPopup = null;
  #selectedIndex: number | null = null;
  #topWidget: QWidget = null;

  constructor(terminalTheme: TerminalTheme, colorPatchPopup: ColorPatchPopup, log: Logger) {
    this.onChanged = this.#onChangedEventEmitter.event;
    this.#colorPatchPopup = colorPatchPopup;

    this.#colorPatchButton = new ColorPatchButton(false, log);
    this.#colorPatchButton.onClicked(() => {
      this.#handleOnClicked();
    });

    this.#topWidget = Frame({
      cssClass: ["table-item"],
      sizePolicy: {
        vertical: QSizePolicyPolicy.Minimum,
        horizontal: QSizePolicyPolicy.MinimumExpanding,
      },
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: 0,
        spacing: 0,
        children: [
          {
            widget: this.#colorPatchButton.getWidget(),
            stretch: 0
          },
          {
            widget: Widget({
              sizePolicy: {
                vertical: QSizePolicyPolicy.Minimum,
                horizontal: QSizePolicyPolicy.MinimumExpanding,
              }
            }),
            stretch: 1
          }
        ]
      })
    });
    this.#terminalTheme = terminalTheme;

    this.setColorIndex(this.#selectedIndex);
  }

  setColorIndex(index: number): void {
    const color = index == null ? null : new QColor(this.#terminalTheme[index]);
    this.#colorPatchButton.setColor(color);
    this.#selectedIndex = index;
  }

  getWidget(): QWidget {
    return this.#topWidget;
  }

  #handleOnClicked(): void {
    const widget = this.#colorPatchButton.getWidget();
    const rect = widget.geometry();
    const bottomLeft = widget.mapToGlobal(new QPoint(0, rect.height()));
    const colorPatchPopupWidget = this.#colorPatchPopup.getWidget();
    this.#colorPatchPopup.setSelectedIndex(this.#selectedIndex);

    const dispose = () => {
      onSelectedDisposable.dispose();
      onCloseDisposable.dispose();
    };

    const onSelectedDisposable = this.#colorPatchPopup.onSelected((index: number) => {
      dispose();
      colorPatchPopupWidget.hide();
      this.setColorIndex(index);
      this.#onChangedEventEmitter.fire(index);
    });
    const onCloseDisposable = this.#colorPatchPopup.onClosed(dispose);

    const hint = colorPatchPopupWidget.sizeHint();
    colorPatchPopupWidget.setGeometry(bottomLeft.x(), bottomLeft.y(), hint.width(), hint.height());
    colorPatchPopupWidget.raise();
    colorPatchPopupWidget.show();
  }
}
