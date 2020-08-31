/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TabTitleWidget, TerminalEnvironment } from '@extraterm/extraterm-extension-api';
import { TerminalTitleEditorWidget} from "./TerminalTitleEditorWidget";
import { IconFormatter } from './IconFormatter';
import { TemplateString } from './TemplateString';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';

let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
}

const terminalToTemplateMap = new WeakMap<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("terminal-title:editTitle", () => {
    const terminalTitleEditorWidget = <TerminalTitleEditorWidget> context.window.activeTerminal.openTerminalBorderWidget("edit-title");
    terminalTitleEditorWidget.focus();
  });

  context.window.registerTabTitleWidget("title", (terminal: Terminal, widget: TabTitleWidget): any => {
    const templateString = new TemplateString();
    templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
    templateString.addFormatter("icon", new IconFormatter());
    templateString.setTemplateString("${icon:fas fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}");

    const newDiv = document.createElement("div");
    newDiv.classList.add("tab_title");
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
    return new TerminalTitleEditorWidget(context, terminal, widget, tabTitleData.templateString,
      tabTitleData.updateTitleFunc);
  });

  // const settingsClass = createSettingsClass(context);
  // context.window.registerSessionSettings("title", settingsClass);
}

// function createSettingsClass(context: ExtensionContext): any {
//   class SessionSettings extends context.window.extensionSessionSettingsBaseConstructor {
//     created(): void {
//       const container = this.getContainerElement();
//       const div = document.createElement("DIV");
//       const t = document.createTextNode("Session settings for Terminal title");
//       div.appendChild(t);
//       container.appendChild(div);
//     }
//   }
//   return SessionSettings;
// }
