/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Label, PushButton } from "qt-construct";
import { Window } from "../Window.js";
import { UiStyle } from "../ui/UiStyle.js";
import { WindowPopOver } from "../ui/WindowPopOver.js";
import { Direction, QBoxLayout, QLabel, QPushButton, QRect, QSizePolicyPolicy, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";


export interface DialogPopOverOptions extends ExtensionApi.DialogOptions {
  containingRect?: QRect;
  aroundRect?: QRect;
}

export class DialogPopOver {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #messageLabel: QLabel = null;
  #windowPopOver: WindowPopOver = null;
  #containingRect: QRect = null;
  #optionButtons: QPushButton[] = [];
  #optionsLayout: QBoxLayout = null;

  #resolveFunc: (value: number) => void = null;

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
            Widget({
              contentsMargins: 0,
              layout: this.#optionsLayout = BoxLayout({
                contentsMargins: 0,
                direction: Direction.LeftToRight,
                children: []
              })
            })
          ]
        })
      })
    );
    this.#windowPopOver.onClose(this.#onClose.bind(this));
  }

  #onClose(): void {
    this.#sendResult(null);
  }

  #sendResult(id: number) :void {
    this.hide();
    doLater( () => {
      try {
        const resolveFunc = this.#resolveFunc;
        this.#resolveFunc = null;
        this.#containingRect = null;
        resolveFunc(id);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  show(window: Window, options: DialogPopOverOptions): Promise<number> {
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
    this.#createOptionButtons(options);

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
    if (this.#optionButtons.length !== 0){
      this.#optionButtons[0].setFocus();
    }

    return new Promise<number>((resolve, reject) => {
      this.#resolveFunc = resolve;
    });
  }

  hide(): void {
    this.#windowPopOver.hide();
  }

  #createOptionButtons(options: DialogPopOverOptions): void {
    for (const button of this.#optionButtons) {
      button.setParent(null);
    }
    this.#optionButtons = [];

    let i = 0;
    for (const option of options.buttonOptions) {
      const index = i;
      let label = "";
      let cssClass: string[] = [];
      if (typeof option === "string") {
        label = option;
      } else {
        label = option.label;
        if (option.type != null) {
          cssClass = [option.type];
        }
      }
      const newButton = PushButton({
        text: label,
        cssClass,
        onClicked: () => {
          this.#sendResult(index);
        }
      });
      this.#optionsLayout.addWidget(newButton);
      i++;
    }
  }
}
