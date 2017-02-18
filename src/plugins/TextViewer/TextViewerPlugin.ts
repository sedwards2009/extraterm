/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as PluginApi from '../../PluginApi';
import Logger from '../../Logger';
import TextViewer = require('../../viewers/textviewer');
import PopDownListPicker = require('../../gui/PopDownListPicker');
import PopDownNumberDialog = require('../../gui/PopDownNumberDialog');
import CodeMirror = require('codemirror');
import he = require('he');

interface SyntaxEntry {
  id: string;
  name: string;
}

class TextViewerPlugin implements PluginApi.ExtratermPlugin {

  private _log: Logger;

  private _syntaxDialog: PopDownListPicker<SyntaxEntry> = null;

  private _tabSizeDialog: PopDownNumberDialog = null;

  constructor(api: PluginApi.ExtratermApi) {
    this._log = new Logger("TextViewerPlugin", this);
    // api.addNewTopLevelEventListener( (el: HTMLElement): void => {
    //   this._log.debug("Saw a new top level");
    // });

    api.addNewTabEventListener( (el: HTMLElement): void => {
      el.addEventListener("TEXTVIEWER_EVENT_COMMAND_SYNTAX_HIGHLIGHTING", this._handleSyntaxHighlighting.bind(this));
    });
    api.addNewTabEventListener( (el: HTMLElement): void => {
      el.addEventListener("TEXTVIEWER_EVENT_COMMAND_TAB_WIDTH", this._handleTabSize.bind(this));
    });
  }

  private _handleSyntaxHighlighting(ev: CustomEvent): void {
    const srcElement = <TextViewer> ev.detail.srcElement;
    if (this._syntaxDialog == null) {
      this._syntaxDialog = <PopDownListPicker<SyntaxEntry>> window.document.createElement(PopDownListPicker.TAG_NAME);
      this._syntaxDialog.setTitlePrimary("Syntax Highlighting");

      this._syntaxDialog.setFormatEntriesFunc( (filteredEntries: SyntaxEntry[], selectedId: string, filterInputValue: string): string => {
        return filteredEntries.map( (entry): string => {
          return `<div class='CLASS_RESULT_ENTRY ${entry.id === selectedId ? PopDownListPicker.CLASS_RESULT_SELECTED : ""}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
            ${he.encode(entry.name)} ${he.encode(entry.id)}
          </div>`;
        }).join("");
      });

      this._syntaxDialog.setFilterAndRankEntriesFunc( (entries: SyntaxEntry[], filterText: string): SyntaxEntry[] => {
        const lowerFilterText = filterText.toLowerCase().trim();
        const filtered = entries.filter( (entry: SyntaxEntry): boolean => {
          return entry.name.toLowerCase().indexOf(lowerFilterText) !== -1 || entry.id.toLowerCase().indexOf(lowerFilterText) !== -1;
        });

        const rankFunc = (entry: SyntaxEntry, lowerFilterText: string): number => {
          const lowerName = entry.name.toLowerCase();
          if (lowerName === lowerFilterText) {
            return 1000;
          }

          const lowerId = entry.id.toLowerCase();
          if (lowerId === lowerFilterText) {
            return 800;
          }

          const pos = lowerName.indexOf(lowerFilterText);
          if (pos !== -1) {
            return 500 - pos; // Bias it for matches at the front of  the text.
          }

          const pos2 = lowerId.indexOf(lowerFilterText);
          if (pos2 !== -1) {
            return 400 - pos2;
          }

          return 0;
        };

        filtered.sort( (a: SyntaxEntry,b: SyntaxEntry): number => rankFunc(b, lowerFilterText) - rankFunc(a, lowerFilterText));

        return filtered;
      });

      this._syntaxDialog.addEventListener("selected", (ev: CustomEvent): void => {
        if (ev.detail.selected != null) {
          srcElement.mimeType = ev.detail.selected;
        }
        srcElement.focus();
      });
      window.document.body.appendChild(this._syntaxDialog);
    }

    const mimeList = CodeMirror.modeInfo.map( (info) => {
      return { id: info.mime, name: info.name};
    });
    this._syntaxDialog.setEntries(mimeList);
    this._syntaxDialog.setSelected(srcElement.mimeType);

    const rect = (<HTMLElement> ev.target).getBoundingClientRect();
    this._syntaxDialog.open(rect.left, rect.top, rect.width, rect.height);
    this._syntaxDialog.focus();
  }

  private _handleTabSize(ev: CustomEvent): void {
    const srcElement = <TextViewer> ev.detail.srcElement;
    if (this._tabSizeDialog == null) {
      this._tabSizeDialog = <PopDownNumberDialog> window.document.createElement(PopDownNumberDialog.TAG_NAME);
      this._tabSizeDialog.setTitlePrimary("Tab Size");
      this._tabSizeDialog.setMinimum(0);
      this._tabSizeDialog.setMaximum(32);

      this._tabSizeDialog.addEventListener("selected", (ev: CustomEvent): void => {
        if (ev.detail.value != null) {
          srcElement.setTabSize(ev.detail.value);
        }
        srcElement.focus();
      });
      window.document.body.appendChild(this._tabSizeDialog);
    }

    this._tabSizeDialog.setValue(srcElement.getTabSize());

    const rect = (<HTMLElement> ev.target).getBoundingClientRect();
    this._tabSizeDialog.open(rect.left, rect.top, rect.width, rect.height);
    this._tabSizeDialog.focus();
  }
}

function factory(api: PluginApi.ExtratermApi): PluginApi.ExtratermPlugin {
  PopDownListPicker.init();
  PopDownNumberDialog.init();
  return new TextViewerPlugin(api);
}
export = factory;
