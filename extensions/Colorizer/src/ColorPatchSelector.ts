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
import { QColor, QPoint, QWidget } from "@nodegui/nodegui";
import { EventEmitter } from "extraterm-event-emitter";
import { ColorPatchButton } from "./ColorPatchButton";
import { ColorPatchPopup } from "./ColorPatchPopup";


export class ColorPatchSelector {

  #onChangedEventEmitter = new EventEmitter<number>();
  onChanged: Event<number> = null;

  #terminalTheme: TerminalTheme = null;

  #colorPatchButton: ColorPatchButton = null;
  #colorPatchPopup: ColorPatchPopup = null;
  #selectedIndex: number | null = null;

  constructor(terminalTheme: TerminalTheme, colorPatchPopup: ColorPatchPopup, log: Logger) {
    this.onChanged = this.#onChangedEventEmitter.event;
    this.#colorPatchPopup = colorPatchPopup;

    this.#colorPatchButton = new ColorPatchButton(false, log);
    this.#colorPatchButton.onClicked(() => {
      this.#handleOnClicked();
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
    return this.#colorPatchButton.getWidget();
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
