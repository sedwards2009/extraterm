/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget } from 'extraterm-extension-api';
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
      this._findNext();
    });
    this._ui.$on("findPrevious", () => {
      this._findPrevious();
    });
    this._ui.$on("close", () => {
      this._widget.close();
    });

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
  }

  focus(): void {
    this._ui.focus();
  }

  private _find(): void {
    // FIXME
    for (const viewer of this._terminal.getViewers()) {
      if (viewer.viewerType === "terminal-output") {
        viewer.find(this._ui.needle);
      }
    }
  }

  private _findNext(): void {
    for (const viewer of this._terminal.getViewers()) {
      if (viewer.viewerType === "terminal-output") {
        viewer.findNext(this._ui.needle);
      }
    }
  }

  private _findPrevious(): void {
    for (const viewer of this._terminal.getViewers()) {
      if (viewer.viewerType === "terminal-output") {
        viewer.findPrevious(this._ui.needle);
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
