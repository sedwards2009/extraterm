/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from '../DomUtils';
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import * as he from 'he';

import {EtTerminal} from '../Terminal';
import {ExtensionUiUtils} from './InternalTypes';
import {Logger, getLogger} from "extraterm-logging";
import {PopDownListPicker} from '../gui/PopDownListPicker';
import {PopDownNumberDialog} from '../gui/PopDownNumberDialog';
import {ViewerElement} from '../viewers/ViewerElement';
import { SupportsDialogStack } from '../SupportsDialogStack';
import { doLater } from 'extraterm-later';


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
    this._numberInputDialog.setMinimum(options.minimum !== undefined ? options.minimum : Number.MIN_SAFE_INTEGER);
    this._numberInputDialog.setMaximum(options.maximum !== undefined ? options.maximum : Number.MAX_SAFE_INTEGER);
    this._numberInputDialog.setValue(options.value);

    const dialogDisposable = host.showDialog(this._numberInputDialog);
    this._numberInputDialog.open();
    focusLater(this._numberInputDialog);

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        dialogDisposable.dispose();
        this._numberInputDialog.removeEventListener('selected', selectedHandler);

        focusLater(this._numberInputDialog);
        resolve(ev.detail.value == null ? undefined : ev.detail.value);
      };

      this._numberInputDialog.addEventListener('selected', selectedHandler);
    });
  }

  showListPicker(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = host;
    }

    if (this._listPicker == null) {
      this._listPicker = <PopDownListPicker<IdLabelPair>> window.document.createElement(PopDownListPicker.TAG_NAME);
      this._listPicker.setFormatEntriesFunc( (filteredEntries: IdLabelPair[], selectedId: string, filterInputValue: string): string => {
        return filteredEntries.map( (entry): string => {
          return `<div class='CLASS_RESULT_ENTRY ${entry.id === selectedId ? PopDownListPicker.CLASS_RESULT_SELECTED : ""}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
            ${he.encode(entry.label)}
          </div>`;
        }).join("");
      });

      this._listPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));
    }

    this._listPicker.titlePrimary = options.title;

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item}));
    this._listPicker.setEntries(convertedItems);
    this._listPicker.selected = "" + options.selectedItemIndex;

    const dialogDisposable = host.showDialog(this._listPicker);
    this._listPicker.open();
    focusLater(this._listPicker);

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        dialogDisposable.dispose();
        this._listPicker.removeEventListener('selected', selectedHandler);
        focusLater(lastFocus);
        resolve(ev.detail.selected == null ? undefined : parseInt(ev.detail.selected, 10));
      };

      this._listPicker.addEventListener('selected', selectedHandler);
    });
  }
      
  _listPickerFilterAndRankEntries(entries: IdLabelPair[], filterText: string): IdLabelPair[] {
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
}

function currentDeepFocusedViewerElement(): ViewerElement {
  const elements = DomUtils.activeNestedElements();
  const viewerElements = <ViewerElement[]> elements.filter(el => el instanceof ViewerElement);
  return viewerElements.length === 0 ? null : viewerElements[0];
}
