/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Label, LineEdit } from "qt-construct";
import { Window } from "../Window.js";
import { UiStyle } from "../ui/UiStyle.js";
import { WindowPopOver } from "../ui/WindowPopOver.js";
import { Direction, Key, QKeyEvent, QLabel, QLineEdit, QPushButton, QRect, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";


export interface TextInputPopOverOptions extends ExtensionApi.TextInputOptions {
  containingRect?: QRect;
  aroundRect?: QRect;
}

export class TextInputPopOver {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #messageLabel: QLabel = null;
  #lineEdit: QLineEdit = null;
  #windowPopOver: WindowPopOver = null;
  #containingRect: QRect = null;

  #resolveFunc: (value: string | undefined) => void = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("DialogPopOver", this);
    this.#uiStyle = uiStyle;
    this.#createPopOver();
  }

  #createPopOver(): void {
    this.#windowPopOver = new WindowPopOver(
      Widget({
        cssClass: ["list-picker"],
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            this.#messageLabel = Label({
              text: "",
              wordWrap: true,
              openExternalLinks: true
            }),
            this.#lineEdit = LineEdit({
              onKeyPress: (nativeEvent) => {
                this.#handleKeyPress(new QKeyEvent(nativeEvent));
              },
            }),
          ]
        })
      })
    );
    this.#windowPopOver.onClose(this.#onClose.bind(this));
  }

  #onClose(): void {
    this.#sendResult(undefined);
  }

  #handleKeyPress(event: QKeyEvent): void {
    const key = event.key();
    if (key === Key.Key_Enter || key === Key.Key_Return) {
      event.accept();
      this.#lineEdit.setEventProcessed(true);
      this.#sendResult(this.#lineEdit.text());
      return;
    }
  }

  #sendResult(value: string | undefined) :void {
    this.hide();
    doLater( () => {
      try {
        const resolveFunc = this.#resolveFunc;
        this.#resolveFunc = null;
        this.#containingRect = null;
        resolveFunc(value);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  show(window: Window, options: TextInputPopOverOptions): Promise<string | undefined> {
    const widthPx = Math.round(500 * window.getDpi() / 96);
    this.#messageLabel.setMinimumWidth(widthPx);

    this.#messageLabel.setTextFormat(TextFormat.PlainText);
    if (options.message == null) {
      this.#messageLabel.hide();
    } else {
      this.#messageLabel.setText(options.message);
      this.#messageLabel.show();
    }
    if (options.isHtml) {
      this.#messageLabel.setTextFormat(TextFormat.RichText);
    }

    this.#lineEdit.setText(options.value ?? "");

    if (options.aroundRect != null) {
      const screenGeometry = window.getWidget().windowHandle().screen().geometry();
      const maxHeight = Math.floor(screenGeometry.height() - options.aroundRect.height() / 2);
      this.#containingRect = new QRect(screenGeometry.left(), screenGeometry.top(), screenGeometry.width(), maxHeight);
    } else {
      this.#containingRect = options.containingRect;
    }

    this.#windowPopOver.position(window, {
      containingRect: this.#containingRect,
      aroundRect: options.aroundRect
    });

    this.#windowPopOver.show();
    this.#lineEdit.setFocus();

    return new Promise<string | undefined>((resolve, reject) => {
      this.#resolveFunc = resolve;
    });
  }

  hide(): void {
    this.#windowPopOver.hide();
  }
}
