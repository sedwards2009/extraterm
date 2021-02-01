/*
 * Copyright 2017-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fuzzyjs from "fuzzyjs";
import * as he from "he";
import * as DomUtils from "../DomUtils";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { html, TemplateResult } from "extraterm-lit-html";
import { DirectiveFn } from "extraterm-lit-html/lib/directive";
import { classMap } from "extraterm-lit-html/directives/class-map";
import { repeat } from "extraterm-lit-html/directives/repeat";
import { unsafeHTML } from "extraterm-lit-html/directives/unsafe-html";
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

  markedupLabel: string;
  score: number;
}

const SELECTION_START_MARKER = "\x01";
const SELECTION_END_MARKER = "\x02";
const SELECTION_START_MARKER_REGEX = /&#x1;/g;
const SELECTION_END_MARKER_REGEX = /&#x2;/g;

function cmpScore(a: IdLabelPair, b: IdLabelPair): number {
  if (a.score === b.score) {
    return 0;
  }
  return a.score < b.score ? -1 : 1;
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
        resolve(ev.detail.selected == null ? undefined : ev.detail.selected);
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
      this._listPicker.setFormatEntriesFunc(this._formatEntries.bind(this));
      this._listPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));
    }

    this._listPicker.titlePrimary = options.title;

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item, markedupLabel: item, score: 0}));
    this._listPicker.setEntries(convertedItems);
    this._listPicker.selected = "" + options.selectedItemIndex;
    this._listPicker.filter = options.filter == null ? "" : options.filter;

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
        const label = this._markupLabel(entry.markedupLabel);
        return html`<div class=${classMap(classes)} data-id=${entry.id}>${unsafeHTML(label)}</div>`;
      }
    );
  }

  private _markupLabel(rawLabel: string): string {
    return he.encode(rawLabel).replace(SELECTION_START_MARKER_REGEX, "<b>")
      .replace(SELECTION_END_MARKER_REGEX, "</b>");
  }

  private _listPickerFilterAndRankEntries(entries: IdLabelPair[], filterText: string): IdLabelPair[] {
    if (filterText.trim() === "") {
      let i = 0;
      for (const entry of entries) {
        entry.score = i;
        entry.markedupLabel = entry.label;
        i++;
      }
      return [...entries];

    } else {
      for (const entry of entries) {
        const result = fuzzyjs.match(filterText, entry.label, { withRanges: true });
        if (result.match) {
          entry.score = result.score;
          const ranges = result.ranges;
          entry.markedupLabel = fuzzyjs.surround(entry.label,
            {
              result: {
                ranges
              },
              prefix: SELECTION_START_MARKER,
              suffix: SELECTION_END_MARKER
            }
          );
        } else {
          entry.score = -1;
          entry.markedupLabel = entry.label;
        }
      }

      const resultEntries = entries.filter(e => e.score !== -1);
      resultEntries.sort(cmpScore);
      return resultEntries;
    }
  }

  showOnCursorListPicker(terminal: EtTerminal, options: ExtensionApi.OnCursorListPickerOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = terminal;
    }

    if (this._onCursorListPicker == null) {
      this._onCursorListPicker = <OnCursorListPicker<IdLabelPair>> window.document.createElement(OnCursorListPicker.TAG_NAME);
      this._onCursorListPicker.setFormatEntriesFunc(this._formatEntries.bind(this));
      this._onCursorListPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));
    }

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item, markedupLabel: item, score: 0}));
    this._onCursorListPicker.setEntries(convertedItems);
    this._onCursorListPicker.selected = "" + options.selectedItemIndex;
    this._onCursorListPicker.filter = options.filter == null ? "" : options.filter;

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
