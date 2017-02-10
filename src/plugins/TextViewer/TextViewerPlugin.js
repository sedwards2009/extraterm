"use strict";
const Logger = require("../../logger");
const PopDownListPicker = require("../../gui/PopDownListPicker");
const CodeMirror = require("codemirror");
const he = require("he");
class TextViewerPlugin {
    constructor(api) {
        this._syntaxDialog = null;
        this._log = new Logger("TextViewerPlugin", this);
        // api.addNewTopLevelEventListener( (el: HTMLElement): void => {
        //   this._log.debug("Saw a new top level");
        // });
        api.addNewTabEventListener((el) => {
            el.addEventListener("TEXTVIEWER_EVENT_COMMAND_SYNTAX_HIGHLIGHTING", this._handleSyntaxHighlighting.bind(this));
        });
    }
    _handleSyntaxHighlighting(ev) {
        const srcElement = ev.detail.srcElement;
        if (this._syntaxDialog == null) {
            this._syntaxDialog = window.document.createElement(PopDownListPicker.TAG_NAME);
            this._syntaxDialog.setTitlePrimary("Syntax Highlighting");
            this._syntaxDialog.setFormatEntriesFunc((filteredEntries, selectedId, filterInputValue) => {
                return filteredEntries.map((entry) => {
                    return `<div class='CLASS_RESULT_ENTRY ${entry.id === selectedId ? PopDownListPicker.CLASS_RESULT_SELECTED : ""}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
            ${he.encode(entry.name)} ${he.encode(entry.id)}
          </div>`;
                }).join("");
            });
            this._syntaxDialog.setFilterEntriesFunc((entries, filterText) => {
                const lowerFilterText = filterText.toLowerCase();
                return entries.filter((entry) => {
                    return entry.name.toLowerCase().indexOf(lowerFilterText) !== -1 || entry.id.toLowerCase().indexOf(lowerFilterText) !== -1;
                });
            });
            this._syntaxDialog.addEventListener("selected", (ev) => {
                if (ev.detail.selected != null) {
                    srcElement.mimeType = ev.detail.selected;
                }
                srcElement.focus();
            });
            window.document.body.appendChild(this._syntaxDialog);
        }
        const mimeList = CodeMirror.modeInfo.map((info) => {
            return { id: info.mime, name: info.name };
        });
        this._syntaxDialog.setEntries(mimeList);
        this._syntaxDialog.setSelected(srcElement.mimeType);
        const rect = ev.target.getBoundingClientRect();
        this._syntaxDialog.open(rect.left, rect.top, rect.width, rect.height);
        this._syntaxDialog.focus();
    }
}
function factory(api) {
    PopDownListPicker.init();
    return new TextViewerPlugin(api);
}
module.exports = factory;
//# sourceMappingURL=TextViewerPlugin.js.map