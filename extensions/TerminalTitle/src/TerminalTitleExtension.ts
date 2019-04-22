/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TabTitleWidget, TerminalEnvironment } from 'extraterm-extension-api';

import { TemplateString } from './TemplateString';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
import { IconFormatter } from './IconFormatter';

let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
}

for (const el of [
  "et-contextmenu",
]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}

const terminalToTemplateMap = new Map<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("terminal-title:editTitle", () => {
    const editTabTitleWidget = <EditTabTitleWidget> context.window.activeTerminal.openTerminalBorderWidget("edit-title");
    editTabTitleWidget.focus();
  });

  context.window.registerTabTitleWidget("title", (terminal: Terminal, widget: TabTitleWidget): any => {
    const templateString = new TemplateString();
    templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
    templateString.addFormatter("icon", new IconFormatter());
    templateString.setTemplateString("${icon:fab fa-linux} ${" + TerminalEnvironment.TERM_TITLE + "}");
  
    const newDiv = document.createElement("div");
    widget.getContainerElement().appendChild(newDiv);

    const updateTitleFunc = () => {
      newDiv.innerHTML = templateString.formatHtml();
    };

    terminal.environment.onChange(updateTitleFunc);

    updateTitleFunc();

    terminalToTemplateMap.set(terminal, { templateString, updateTitleFunc });
    return null;
  });

  context.window.registerTerminalBorderWidget("edit-title", (terminal: Terminal, widget: TerminalBorderWidget): any => {
    const tabTitleData = terminalToTemplateMap.get(terminal);
    return new EditTabTitleWidget(context, terminal, widget, tabTitleData.templateString,
      tabTitleData.updateTitleFunc);
  });
}


class EditTabTitleWidget {

  private _ui: EditTabTitlePanelUI = null;

  constructor(context: ExtensionContext, private _terminal: Terminal, private _widget: TerminalBorderWidget,
      private _templateString: TemplateString, updateFunc: () => void) {

    this._ui = new EditTabTitlePanelUI();

    const component = this._ui.$mount();
    this._widget.getContainerElement().appendChild(component.$el);
    this._ui.template = this._templateString.getTemplateString();
    this._ui.templateDiagnostic = this._templateString.formatDiagnosticHtml();

    this._ui.$on("templateChange", (template: string) => {
      this._templateString.setTemplateString(template);
      updateFunc();
      this._ui.templateDiagnostic = this._templateString.formatDiagnosticHtml();
    });
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
          <input ref="template" type="text" class="char-width-40"
            v-model="template"
            v-on:input="onTemplateChange"
            />
          
          <button class="inline" ref="insertField" v-on:click="onInsertField">Insert Field</button>
          
          <span class="expand"></span>
          <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
        </div>
        <div class="width-100pc" v-html="templateDiagnostic"></div>

        <et-contextmenu ref="insertFieldMenu">
          <div
            class="insert_field_menu_item"
            v-on:click="onInsertFieldClick('term:title')">Title - \${term:title}</div>
        </et-contextmenu>
      </div>`
  })
class EditTabTitlePanelUI extends Vue {
  template: string;
  templateDiagnostic: string;

  constructor() {
    super();
    this.template = "";
    this.templateDiagnostic = "";
  }

  onTemplateChange(): void {
    this.$emit('templateChange', this.template);
  }

  onInsertField(): void {
    (<any> this.$refs.insertFieldMenu).openAround(this.$refs.insertField);
  }

  onInsertFieldClick(fieldName: string): void {
    this.template = this.template + `\${${fieldName}}`;
    (<any> this.$refs.insertFieldMenu).close();
    this.$emit('templateChange', this.template);
  }

  focus(): void {
    if (this.$refs.template != null) {
      (<HTMLInputElement> this.$refs.template).focus();
    }
  }
}
