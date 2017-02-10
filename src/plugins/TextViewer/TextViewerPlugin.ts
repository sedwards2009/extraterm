/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as PluginApi from '../../PluginApi';
import Logger =  require('../../logger');
import TextViewer = require('../../viewers/textviewer');
import PopDownListPicker = require('../../gui/PopDownListPicker');
import CodeMirror = require('codemirror');
import he = require('he');

interface SyntaxEntry {
  id: string;
  name: string;
}

class TextViewerPlugin implements PluginApi.ExtratermPlugin {

  private _log: Logger;

  private _syntaxDialog: PopDownListPicker<SyntaxEntry> = null;

  constructor(api: PluginApi.ExtratermApi) {
    this._log = new Logger("TextViewerPlugin", this);
    // api.addNewTopLevelEventListener( (el: HTMLElement): void => {
    //   this._log.debug("Saw a new top level");
    // });

    api.addNewTabEventListener( (el: HTMLElement): void => {
      el.addEventListener("TEXTVIEWER_EVENT_COMMAND_SYNTAX_HIGHLIGHTING", this._handleSyntaxHighlighting.bind(this));
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

      this._syntaxDialog.setFilterEntriesFunc( (entries: SyntaxEntry[], filterText: string): SyntaxEntry[] => {
        const lowerFilterText = filterText.toLowerCase();
        return entries.filter( (entry: SyntaxEntry): boolean => {
          return entry.name.toLowerCase().indexOf(lowerFilterText) !== -1 || entry.id.toLowerCase().indexOf(lowerFilterText) !== -1;
        });
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

}

function factory(api: PluginApi.ExtratermApi): PluginApi.ExtratermPlugin {
  PopDownListPicker.init();
  return new TextViewerPlugin(api);
}
export = factory;
