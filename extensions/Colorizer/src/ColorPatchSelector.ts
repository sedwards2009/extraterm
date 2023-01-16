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
  #log: Logger = null;

  #onChangedEventEmitter = new EventEmitter<number>();
  onChanged: Event<number> = null;

  #terminalTheme: TerminalTheme = null;

  #colorPatchButton: ColorPatchButton = null;
  #colorPatchPopup: ColorPatchPopup = null;
  #selectedIndex: number | null = null;
  #topWidget: QWidget = null;

  constructor(terminalTheme: TerminalTheme, colorPatchPopup: ColorPatchPopup, log: Logger) {
    this.#log = log;
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

    this.#positionAround(colorPatchPopupWidget, this.#colorPatchButton.getWidget());

    colorPatchPopupWidget.raise();
    colorPatchPopupWidget.show();
  }

  #positionAround(popup: QWidget, target: QWidget): void {
    const rect = target.geometry();
    const hint = popup.sizeHint();
    const bottomLeft = target.mapToGlobal(new QPoint(0, rect.height()));
    let x = bottomLeft.x();
    let y = bottomLeft.y();
    const screenGeometry = target.window().windowHandle().screen().geometry();
    if (y + hint.height() > screenGeometry.top() + screenGeometry.height()) {
      const topLeft = target.mapToGlobal(new QPoint(0, 0));
      y = topLeft.y() - hint.height();
    }
    x = Math.min(x, screenGeometry.left() + screenGeometry.width() - hint.width());
    x = Math.max(x, screenGeometry.left());
    popup.setGeometry(x, y, hint.width(), hint.height());
  }
}
