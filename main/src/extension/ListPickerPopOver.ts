/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Label } from "qt-construct";
import { Window } from "../Window.js";
import { Entry, FieldType, ListPicker } from "../ui/ListPicker.js";
import { UiStyle } from "../ui/UiStyle.js";
import { Orientation, WindowPopOver } from "../ui/WindowPopOver.js";
import { Direction, QLabel, QRect, QSizePolicyPolicy, WidgetEventTypes } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";


export interface ListPickerPopOverOptions extends ExtensionApi.ListPickerOptions {
  containingRect?: QRect;
  aroundRect?: QRect;
}

export class ListPickerPopOver {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #listPicker: ListPicker = null;
  #titleLabel: QLabel = null;
  #windowPopOver: WindowPopOver = null;
  #containingRect: QRect = null;

  #resolveFunc: (value: number) => void = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("ListPickerPopover", this);
    this.#uiStyle = uiStyle;
    this.#createPopOver();
  }

  #createPopOver(): void {
    this.#listPicker = new ListPicker(this.#uiStyle);
    this.#windowPopOver = new WindowPopOver(
      Widget({
        cssClass: ["list-picker"],
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            this.#titleLabel = Label({text: ""}),
            this.#listPicker.getWidget()
          ]
        })
      })
    );
    this.#windowPopOver.onClose(this.#onClose.bind(this));
    this.#listPicker.getWidget().setSizePolicy(QSizePolicyPolicy.Fixed, QSizePolicyPolicy.Expanding);

    this.#listPicker.onSelected((id: string) => this.#onSelected(id));
    this.#listPicker.onContentAreaChanged(() => this.#updateHeight());
  }

  #onClose(): void {
    this.#sendResult(null);
  }

  #onSelected(id: string): void {
    this.#sendResult(parseInt(id, 10));
  }

  #updateHeight(): void {
    if (this.#containingRect == null) {
      return;
    }
    const contentHeight = this.#listPicker.getContentsHeight();
    const maxListAreaHeight = Math.floor((this.#containingRect.height() /2) * 0.8);
    const listAreaHeight = Math.min(contentHeight, maxListAreaHeight);
    this.#listPicker.setListAreaFixedHeight(listAreaHeight);
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

  show(window: Window, options: ListPickerPopOverOptions): Promise<number> {
    const widthPx = Math.round(500 * window.getDpi() / 96);
    this.#listPicker.getWidget().setFixedWidth(widthPx);

    if (options.title == null) {
      this.#titleLabel.hide();
    } else {
      this.#titleLabel.setText(options.title);
      this.#titleLabel.show();
    }

    const entries = options.items.map((entry: string, index: number): Entry =>
      ({
          id: "" + index,
          searchText: entry,
          fields: [entry]
      }));
    this.#listPicker.setEntries([FieldType.TEXT], entries);
    this.#listPicker.setText("");

    if (options.aroundRect != null) {
      const screenGeometry = window.getWidget().windowHandle().screen().geometry();
      const maxHeight = Math.floor(screenGeometry.height() - options.aroundRect.height() / 2);
      this.#containingRect = new QRect(screenGeometry.left(), screenGeometry.top(), screenGeometry.width(), maxHeight);
    } else {
      this.#containingRect = options.containingRect;
    }

    const orientation = this.#windowPopOver.position(window, {
      containingRect: this.#containingRect,
      aroundRect: options.aroundRect
    });
    this.#listPicker.setReverse(orientation === Orientation.Above);
    this.#updateHeight();

    this.#windowPopOver.show();
    this.#listPicker.focus();

    return new Promise<number>((resolve, reject) => {
      this.#resolveFunc = resolve;
    });
  }

  hide(): void {
    this.#windowPopOver.hide();
  }
}
