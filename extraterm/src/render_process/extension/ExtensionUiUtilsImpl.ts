/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from "../DomUtils";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { html, TemplateResult } from "extraterm-lit-html";
import { DirectiveFn } from "extraterm-lit-html/lib/directive";
import { classMap } from "extraterm-lit-html/directives/class-map";
import { repeat } from "extraterm-lit-html/directives/repeat";
import { doLater } from "extraterm-later";
import { Logger, getLogger} from "extraterm-logging";
import { EtTerminal } from "../Terminal";
import { ExtensionUiUtils } from "./InternalTypes";
import { PopDownListPicker } from "../gui/PopDownListPicker";
import { PopDownNumberDialog } from "../gui/PopDownNumberDialog";
import { ViewerElement } from "../viewers/ViewerElement";
import { SupportsDialogStack } from "../SupportsDialogStack";
import { OnCursorListPicker } from "../gui/OnCursorListPicker";


interface IdLabelPair {
  id: string;
  label: string;
}

interface Focusable {
  focus(): void;
}

let elementToFocus: Focusable = null;

/**
 * Focus an element later.
 *
 * Multiple calls to this will only respect the last call.
 */
function focusLater(el: Focusable): void {
  elementToFocus = el;
  doLater(() => {
    if (elementToFocus == null) {
      return;
    }
    elementToFocus.focus();
    elementToFocus = null;
  });
}

export class ExtensionUiUtilsImpl implements ExtensionUiUtils {

  private _log: Logger = null;
  private _numberInputDialog: PopDownNumberDialog = null;
  private _listPicker: PopDownListPicker<IdLabelPair> = null;
  private _onCursorListPicker: OnCursorListPicker<IdLabelPair> = null;

  constructor() {
    this._log = getLogger("ExtensionUiUtilsImpl", this);
  }

  showNumberInput(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = host;
    }

    if (this._numberInputDialog == null) {
      this._numberInputDialog = <PopDownNumberDialog> window.document.createElement(PopDownNumberDialog.TAG_NAME);
    }
    this._numberInputDialog.titlePrimary = options.title;
    this._numberInputDialog.min = options.minimum !== undefined ? options.minimum : Number.MIN_SAFE_INTEGER;
    this._numberInputDialog.max = options.maximum !== undefined ? options.maximum : Number.MAX_SAFE_INTEGER;
    this._numberInputDialog.value = options.value;

    const dialogDisposable = host.showDialog(this._numberInputDialog);
    this._numberInputDialog.open = true;
    focusLater(this._numberInputDialog);

    return this._createInputPromise(this._numberInputDialog, dialogDisposable, lastFocus);
  }

  private _createInputPromise(inputElement: HTMLElement, dialogDisposable: ExtensionApi.Disposable,
      lastFocus: HTMLElement): Promise<number | undefined> {

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        dialogDisposable.dispose();
        inputElement.removeEventListener('selected', selectedHandler);

        focusLater(lastFocus);
        resolve(ev.detail.value == null ? undefined : ev.detail.value);
      };

      inputElement.addEventListener('selected', selectedHandler);
    });
  }

  showListPicker(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = host;
    }

    if (this._listPicker == null) {
      this._listPicker = <PopDownListPicker<IdLabelPair>> window.document.createElement(PopDownListPicker.TAG_NAME);
      this._listPicker.setFormatEntriesFunc(this._formatEntries);
      this._listPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));
    }

    this._listPicker.titlePrimary = options.title;

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item}));
    this._listPicker.setEntries(convertedItems);
    this._listPicker.selected = "" + options.selectedItemIndex;

    const dialogDisposable = host.showDialog(this._listPicker);
    this._listPicker.open();
    focusLater(this._listPicker);

    return this._createInputPromise(this._listPicker, dialogDisposable, lastFocus);
  }

  private _formatEntries(filteredEntries: IdLabelPair[], selectedId: string, filterInputValue: string): DirectiveFn | TemplateResult {
    return repeat(
      filteredEntries,
      (entry) => entry.id,
      (entry, index) => {
        const classes = {CLASS_RESULT_ENTRY: true, CLASS_RESULT_SELECTED: entry.id === selectedId};
        return html`<div class=${classMap(classes)} data-id=${entry.id}>${entry.label}</div>`;
      }
    );
  }

  private _listPickerFilterAndRankEntries(entries: IdLabelPair[], filterText: string): IdLabelPair[] {
    const lowerFilterText = filterText.toLowerCase().trim();

    if (lowerFilterText === "") { // Special case for when no filter is entered.
      return [...entries];
    }

    const filtered = entries.filter( (entry: IdLabelPair): boolean => {
      return entry.label.toLowerCase().indexOf(lowerFilterText) !== -1;
    });

    const rankFunc = (entry: IdLabelPair, lowerFilterText: string): number => {
      const lowerName = entry.label.toLowerCase();
      if (lowerName === lowerFilterText) {
        return 1000;
      }

      const pos = lowerName.indexOf(lowerFilterText);
      if (pos !== -1) {
        return 500 - pos; // Bias it for matches at the front of  the text.
      }

      return 0;
    };

    filtered.sort( (a: IdLabelPair,b: IdLabelPair): number => rankFunc(b, lowerFilterText) - rankFunc(a, lowerFilterText));

    return filtered;
  }

  showOnCursorListPicker(terminal: EtTerminal, options: ExtensionApi.OnCursorListPickerOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = terminal;
    }

    if (this._onCursorListPicker == null) {
      this._onCursorListPicker = <OnCursorListPicker<IdLabelPair>> window.document.createElement(OnCursorListPicker.TAG_NAME);
      this._onCursorListPicker.setFormatEntriesFunc(this._formatEntries);
      this._onCursorListPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));
    }

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item}));
    this._onCursorListPicker.setEntries(convertedItems);
    this._onCursorListPicker.selected = "" + options.selectedItemIndex;

    const dialogDisposable = terminal.showDialog(this._onCursorListPicker);

    const cursorPosition = terminal.getEmulatorCursorRect();
    this._onCursorListPicker.cursorTop = cursorPosition.top;
    this._onCursorListPicker.cursorBottom = cursorPosition.bottom;
    this._onCursorListPicker.cursorLeft = cursorPosition.left;

    this._onCursorListPicker.open();
    focusLater(this._onCursorListPicker);

    return this._createInputPromise(this._onCursorListPicker, dialogDisposable, lastFocus);
  }
}

function currentDeepFocusedViewerElement(): ViewerElement {
  const elements = DomUtils.activeNestedElements();
  const viewerElements = <ViewerElement[]> elements.filter(el => el instanceof ViewerElement);
  return viewerElements.length === 0 ? null : viewerElements[0];
}
