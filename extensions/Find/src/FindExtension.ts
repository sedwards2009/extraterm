/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalOutputViewer, FindStartPosition } from 'extraterm-extension-api';
import Component from 'vue-class-component';
import Vue from 'vue';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

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
      this._findForewards();
    });
    this._ui.$on("close", () => {
      this._close();
    });

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
  }

  focus(): void {
    this._ui.focus();
  }

  private _close(): void {
    const termViewers = this._getTerminalOutputViewer();
    for (const viewer of termViewers) {
      viewer.highlight(null);
    }

    this._widget.close();
  }

  private _find(): void {
    const termViewers = this._getTerminalOutputViewer();
    for (const viewer of termViewers) {
      viewer.highlight(new RegExp(this._ui.needle, "g"));
    }

    for (let i=termViewers.length-1; i> 0; i--) {
      if (termViewers[i].find(this._ui.needle, { backwards: true, startPosition: FindStartPosition.DOCUMENT_END })) {
        break;
      }
    }
  }

  private _getTerminalOutputViewer(): TerminalOutputViewer[] {
    const termViewers: TerminalOutputViewer[] = [];
    for (const viewer of this._terminal.getViewers()) {
      if (viewer.viewerType === "terminal-output") {
        termViewers.push(viewer);
      } else if (viewer.viewerType === "frame") {
        const contents = viewer.getContents();
        if (contents != null && contents.viewerType === "terminal-output") {
          termViewers.push(contents);
        }
      }
    }
    return termViewers;
  }

  private _findForewards(): void {
    const termViewers = this._getTerminalOutputViewer();

    for (const viewer of termViewers) {
      viewer.highlight(new RegExp(this._ui.needle, "g"));
    }

    let i = termViewers.findIndex(v => v.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    if (termViewers[i].findNext(this._ui.needle)) {
      return;
    }
    i++;

    for ( ; i<termViewers.length; i++) {
      if (termViewers[i].find(this._ui.needle, { startPosition: FindStartPosition.DOCUMENT_START })) {
        return;
      }
    }
  }

  private _findBackwards(): void {
    const termViewers = this._getTerminalOutputViewer();

    for (const viewer of termViewers) {
      viewer.highlight(new RegExp(this._ui.needle, "g"));
    }

    let i = termViewers.findIndex(v => v.hasSelection());
    if (i === -1) {
      this._find();
      return;
    }

    if (termViewers[i].findPrevious(this._ui.needle)) {
      return;
    }
    i--;

    for ( ; i > 0; i--) {
      if (termViewers[i].find(this._ui.needle, { startPosition: FindStartPosition.DOCUMENT_END, backwards: true })) {
        return;
      }
    }
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
        <button v-on:click="$emit('findNext')" class="inline"><i class="fas fa-arrow-up"></i> Find Next</button>
        <button v-on:click="$emit('findPrevious')" class="inline"><i class="fas fa-arrow-down"></i> Find Previous</button>
        <span class="expand"></span>
        <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
      </div>`)
  })
class FindPanelUI extends Vue {
  needle: string;

  constructor() {
    super();
    this.needle = "";
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
}
