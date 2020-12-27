/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Block,
  ExtensionContext,
  FindStartPosition,
  Logger,
  Terminal,
  TerminalBorderWidget,
  TerminalOutputDetails,
  TerminalOutputType,
  TextViewerDetails,
  TextViewerType,
} from '@extraterm/extraterm-extension-api';
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
    this._widget.containerElement.appendChild(component.$el);
    this._terminal.onDidAppendBlock((block: Block) => {
      this._handleBlockAppended(block);
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

    const termBlocks = this._getBlockDetails();
    const needleRegExp = this._needleRegExp();

    for (let i=termBlocks.length-1; i>=0; i--) {
      if (termBlocks[i].find(needleRegExp, { backwards: true, startPosition: FindStartPosition.DOCUMENT_END })) {
        break;
      }
    }
  }

  private _applyHighlight(): void {
    const termViewers = this._getBlockDetails();
    for (const viewer of termViewers) {
      viewer.highlight(this._needleRegExp("g"));
    }
  }

  private _removeHighlight(): void {
    const termViewers = this._getBlockDetails();
    for (const viewer of termViewers) {
      viewer.highlight(null);
    }
  }

  private _getBlockDetails(): (TerminalOutputDetails | TextViewerDetails)[] {
    const termBlockDetails: (TerminalOutputDetails | TextViewerDetails)[] = [];
    for (const block of this._terminal.blocks) {
      const details = this._unpackBlock(block);
      if (details != null) {
        termBlockDetails.push(details);
      }
    }
    return termBlockDetails;
  }

  private _unpackBlock(block: Block): TerminalOutputDetails | TextViewerDetails {
    if (block.type === TerminalOutputType || block.type === TextViewerType) {
      return block.details;
    }
    return null;
  }

  private _handleBlockAppended(block: Block): void {
    if (this._widget.isOpen) {
      const details = this._unpackBlock(block);
      if (details != null) {
        details.highlight(this._needleRegExp("g"));
      }
    }
  }

  private _findForwards(): void {
    this._applyHighlight();

    const termBlocks = this._getBlockDetails();
    let i = termBlocks.findIndex(v => v.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    const needleRegExp = this._needleRegExp();
    if (termBlocks[i].findNext(needleRegExp)) {
      return;
    }
    i++;

    for ( ; i<termBlocks.length; i++) {
      if (termBlocks[i].find(needleRegExp, { startPosition: FindStartPosition.DOCUMENT_START })) {
        return;
      }
    }
  }

  private _findBackwards(): void {
    this._applyHighlight();

    const termDetails = this._getBlockDetails();
    let i = termDetails.findIndex(d => d.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    const needleRegExp = this._needleRegExp();
    if (termDetails[i].findPrevious(needleRegExp)) {
      return;
    }
    i--;

    for ( ; i >= 0; i--) {
      if (termDetails[i].find(needleRegExp, { startPosition: FindStartPosition.DOCUMENT_END, backwards: true })) {
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
          spellcheck="false"
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
