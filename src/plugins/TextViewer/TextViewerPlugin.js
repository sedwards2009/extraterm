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
            this._syntaxDialog.setFilterAndRankEntriesFunc((entries, filterText) => {
                const lowerFilterText = filterText.toLowerCase().trim();
                const filtered = entries.filter((entry) => {
                    return entry.name.toLowerCase().indexOf(lowerFilterText) !== -1 || entry.id.toLowerCase().indexOf(lowerFilterText) !== -1;
                });
                const rankFunc = (entry, lowerFilterText) => {
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
                filtered.sort((a, b) => rankFunc(b, lowerFilterText) - rankFunc(a, lowerFilterText));
                return filtered;
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