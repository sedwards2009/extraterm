/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalOutputViewer, FindStartPosition, TextViewer, Viewer } from 'extraterm-extension-api';
import Component from 'vue-class-component';
import Vue from 'vue';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
const escapeStringRegexp = require('escape-string-regexp');

let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("find:find", () => {
    const findWidget = <FindWidget> context.window.activeTerminal.openTerminalBorderWidget("find");
    findWidget.focus();
  });

  context.window.registerTerminalBorderWidget("find", (terminal: Terminal, widget: TerminalBorderWidget): any => {
    return new FindWidget(context, terminal, widget);
  });
}


class FindWidget {

  private _ui: FindPanelUI = null;

  constructor(context: ExtensionContext, private _terminal: Terminal, private _widget: TerminalBorderWidget) {
    this._ui = new FindPanelUI();
    this._ui.$on("find", () => {
      this._find();
    });
    this._ui.$on("findNext", () => {
      this._findBackwards();
    });
    this._ui.$on("findPrevious", () => {
      this._findForwards();
    });
    this._ui.$on("close", () => {
      this._close();
    });
    this._ui.$on("regularExpressionChange", () => {
      this._find();
    });
    this._ui.$on("caseSensitiveChange", () => {
      this._find();
    });

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
    this._terminal.onDidAppendViewer((viewer: Viewer) => {
      this._handleViewerAppended(viewer);
    });

    this._widget.onDidClose(() => {
      this._handleClose();
    });

    this._widget.onDidOpen(() => {
      this._applyHighlight();
    });
  }

  focus(): void {
    this._ui.focus();
  }

  private _needleRegExp(extraFlags=""): RegExp {
    let flags = extraFlags;
    if ( ! this._ui.caseSensitive) {
      flags = flags + "i";
    }
    if (this._ui.regularExpression) {
      return new RegExp(this._ui.needle, flags);
    } else {
      return new RegExp(escapeStringRegexp(this._ui.needle), flags);
    }
  }

  private _find(): void {
    this._applyHighlight();

    const termViewers = this._getViewers();
    const needleRegExp = this._needleRegExp();

    for (let i=termViewers.length-1; i>=0; i--) {
      if (termViewers[i].find(needleRegExp, { backwards: true, startPosition: FindStartPosition.DOCUMENT_END })) {
        break;
      }
    }
  }

  private _applyHighlight(): void {
    const termViewers = this._getViewers();
    for (const viewer of termViewers) {
      viewer.highlight(this._needleRegExp("g"));
    }
  }

  private _removeHighlight(): void {
    const termViewers = this._getViewers();
    for (const viewer of termViewers) {
      viewer.highlight(null);
    }
  }

  private _getViewers(): (TerminalOutputViewer | TextViewer)[] {
    const termViewers: (TerminalOutputViewer | TextViewer)[] = [];
    for (const viewer of this._terminal.getViewers()) {
      const v = this._unpackViewer(viewer);
      if (v != null) {
        termViewers.push(v);
      }
    }
    return termViewers;
  }

  private _unpackViewer(viewer: Viewer): TerminalOutputViewer | TextViewer {
    if (viewer.viewerType === "terminal-output") {
      return viewer;
    } else if (viewer.viewerType === "frame") {
      const contents = viewer.getContents();
      if (contents != null && (contents.viewerType === "terminal-output" || contents.viewerType === "text")) {
        return contents;
      }
    }
    return null;
  }

  private _handleViewerAppended(viewer: Viewer): void {
    if (this._widget.isOpen()) {
      const v = this._unpackViewer(viewer);
      if (v != null) {
        v.highlight(this._needleRegExp("g"));
      }
    }
  }

  private _findForwards(): void {
    this._applyHighlight();

    const termViewers = this._getViewers();
    let i = termViewers.findIndex(v => v.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    const needleRegExp = this._needleRegExp();
    if (termViewers[i].findNext(needleRegExp)) {
      return;
    }
    i++;

    for ( ; i<termViewers.length; i++) {
      if (termViewers[i].find(needleRegExp, { startPosition: FindStartPosition.DOCUMENT_START })) {
        return;
      }
    }
  }

  private _findBackwards(): void {
    this._applyHighlight();

    const termViewers = this._getViewers();
    let i = termViewers.findIndex(v => v.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    const needleRegExp = this._needleRegExp();
    if (termViewers[i].findPrevious(needleRegExp)) {
      return;
    }
    i--;

    for ( ; i >= 0; i--) {
      if (termViewers[i].find(needleRegExp, { startPosition: FindStartPosition.DOCUMENT_END, backwards: true })) {
        return;
      }
    }
  }

  private _handleClose(): void {
    this._removeHighlight();
  }

  private _close(): void {
    this._widget.close();
  }

}

@Component(
  {
    template: trimBetweenTags(`
      <div class="gui-packed-row width-100pc">
        <label class="compact"><i class="fas fa-search"></i></label>
        <input ref="needle" type="text" class="char-width-20"
          v-model="needle"
          placeholder="Find"
          v-on:keydown.capture="onNeedleKeyDown"
          v-on:keypress.capture="onNeedleKeyPress"
          />
        <span class="group">
          <button v-on:click="$emit('findNext')" class="inline"><i class="fas fa-arrow-up"></i></button>
          <button v-on:click="$emit('findPrevious')" class="inline"><i class="fas fa-arrow-down"></i></button>
        </span>
        <span class="group">
          <button v-on:click="onRegularExpressionClick" v-bind:class="{ inline: true, selected: this.regularExpression }" title="Search as regular expression">.*</button>
          <button v-on:click="onCaseSensitive" v-bind:class="{ inline: true, selected: this.caseSensitive }" title="Case sensitive">aA</button>
        </span>
        <span class="expand"></span>
        <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
      </div>`)
  })
class FindPanelUI extends Vue {
  needle: string;
  caseSensitive: boolean;
  regularExpression: boolean;

  constructor() {
    super();
    this.needle = "";
    this.caseSensitive = false;
    this.regularExpression = false;
  }

  focus(): void {
    if (this.$refs.needle != null) {
      (<HTMLInputElement> this.$refs.needle).focus();
    }
  }

  onNeedleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.$emit("close");
    }
  }
  onNeedleKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.$emit("findNext");
    }
  }

  onRegularExpressionClick(): void {
    this.regularExpression = ! this.regularExpression;
    this.$emit("regularExpressionChange");
  }

  onCaseSensitive(): void {
    this.caseSensitive = ! this.caseSensitive;
    this.$emit("caseSensitiveChange");
  }
}
