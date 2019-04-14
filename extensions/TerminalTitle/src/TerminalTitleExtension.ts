/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TabTitleWidget, TerminalEnvironment } from 'extraterm-extension-api';
import Component from 'vue-class-component';
import Vue from 'vue';

let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("terminal-title:editTitle", () => {
    const editTabTitleWidget = <EditTabTitleWidget> context.window.activeTerminal.openTerminalBorderWidget("edit-title");
    editTabTitleWidget.focus();
  });

  context.window.registerTabTitleWidget("title", (terminal: Terminal, widget: TabTitleWidget): any => {
    const newDiv = document.createElement("div");
    widget.getContainerElement().appendChild(newDiv);

    const updateTitle = () => {
      newDiv.innerText = terminal.environment.get(TerminalEnvironment.TERM_TITLE);
    };

    terminal.environment.onChange(key => {
      if (key.indexOf(TerminalEnvironment.TERM_TITLE) !== -1) {
        updateTitle();
      }
    });

    updateTitle();
    return null;
  });

  context.window.registerTerminalBorderWidget("edit-title", (terminal: Terminal, widget: TerminalBorderWidget): any => {
    return new EditTabTitleWidget(context, terminal, widget);
  });
}

class EditTabTitleWidget {

  private _ui: EditTabTitlePanelUI = null;

  constructor(context: ExtensionContext, private _terminal: Terminal, private _widget: TerminalBorderWidget) {
    this._ui = new EditTabTitlePanelUI();

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
    this._ui.$on("close", () => {
      this._close();
    });
  }

  focus(): void {
    this._ui.focus();
  }

  private _close(): void {
    this._widget.close();
  }
}

@Component(
  {
    template: `
      <div class="width-100pc">
        <div class="gui-packed-row width-100pc">
          <label class="compact"><i class="fas fa-pen"></i></label>
          <input ref="titleFormat" type="text" class="char-width-40"
            v-model="titleFormat"
            />
          <span class="expand"></span>
          <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
        </div>
        <div class="width-100pc">
Title preview goes here.
        </div>
      </div>`
  })
class EditTabTitlePanelUI extends Vue {
  titleFormat: string;

  constructor() {
    super();
    this.titleFormat = "";
  }

  focus(): void {
    if (this.$refs.titleFormat != null) {
      (<HTMLInputElement> this.$refs.titleFormat).focus();
    }
  }

  // onCaseSensitive(): void {
  //   this.caseSensitive = ! this.caseSensitive;
  //   this.$emit("caseSensitiveChange");
  // }
}
