/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, log, getLogger } from "extraterm-logging";
import { doLater } from "extraterm-timeoutqt";
import { Label } from "qt-construct";
import { Tab } from "../Tab.js";
import { Window } from "../Window.js";
import { Entry, FieldType, ListPicker } from "../ui/ListPicker.js";
import { UiStyle } from "../ui/UiStyle.js";
import { WindowPopOver } from "../ui/WindowPopOver.js";
import { QLabel, QRect, WidgetEventTypes } from "@nodegui/nodegui";

export class ListPickerPopOver {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;
  #listPicker: ListPicker = null;
  #titleLabel: QLabel = null;
  #windowPopOver: WindowPopOver = null;
  #containingRect: QRect = null;
  #listPickerAfterLayoutFunc: () => void = null;

  #resolveFunc: (value: number) => void = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("ListPickerPopover", this);
    this.#uiStyle = uiStyle;
    this.#createPopOver();
  }

  #createPopOver(): void {
    this.#listPicker = new ListPicker(this.#uiStyle);
    this.#windowPopOver = new WindowPopOver([
      this.#titleLabel = Label({text: ""}),
      this.#listPicker.getWidget()
    ]);
    this.#windowPopOver.onClose(this.#onClose.bind(this));
    this.#listPicker.onSelected((id: string) => this.#onSelected(id));
    this.#listPicker.onContentAreaChanged(() => this.#updateHeight());
    this.#listPicker.getWidget().addEventListener(WidgetEventTypes.LayoutRequest, () => {
      if (this.#listPickerAfterLayoutFunc == null) {
        return;
      }
      this.#listPickerAfterLayoutFunc();
      this.#listPickerAfterLayoutFunc = null;
    });
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
    const maxListAreaHeight = Math.floor(this.#containingRect.height() * 0.8);
    if (contentHeight > maxListAreaHeight) {
      // Limit the pop up window height and allow contents to scroll
      this.#listPicker.clearListAreaFixedHeight();
      this.#windowPopOver.clearFixedHeight();
      this.#listPickerAfterLayoutFunc = null;
    } else {
      // Shrink the list picker area to match the contents, and shrink the window height to match.
      this.#listPicker.setListAreaFixedHeight(contentHeight);
      this.#listPickerAfterLayoutFunc = () => {
        this.#windowPopOver.setFixedHeightToSizeHint();
      };
    }
  }

  #sendResult(id: number) :void {
    this.hide();
    doLater( () => {
      try {
        const resolveFunc = this.#resolveFunc;
        this.#resolveFunc = null;
        this.#listPickerAfterLayoutFunc = null;
        this.#containingRect = null;
        resolveFunc(id);
      } catch(e) {
        this._log.warn(e);
      }
    });
  }

  show(window: Window, tab: Tab, options: ExtensionApi.ListPickerOptions): Promise<number> {
    this.#titleLabel.setText(options.title);

    const entries = options.items.map((entry: string, index: number): Entry =>
      ({
          id: "" + index,
          searchText: entry,
          fields: [entry]
      }));
    this.#listPicker.setEntries([FieldType.TEXT], entries);
    this.#listPicker.setText("");

    this.#containingRect = window.getTabGlobalGeometry(tab);
    this.#windowPopOver.position(window, {
      containingRect: window.getTabGlobalGeometry(tab)
    });
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
