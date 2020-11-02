/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TabTitleWidget, TerminalEnvironment, SessionSettingsEditorBase } from '@extraterm/extraterm-extension-api';
import { TerminalTitleEditorWidget} from "./TerminalTitleEditorWidget";
import { IconFormatter } from './IconFormatter';
import { TemplateString } from './TemplateString';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
import { setupTerminalTitleSessionSettings, Settings } from './TerminalTitleSessionSettings';

let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
}

const terminalToTemplateMap = new WeakMap<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.commands.registerCommand("terminal-title:editTitle", commandEditTitle.bind(context));
  context.window.registerTabTitleWidget("title", tabTitleWidgetFactory);
  context.window.registerTerminalBorderWidget("edit-title", terminalBorderWidgetFactory.bind(context));
  context.window.registerSessionSettingsEditor("title", sessionSettingsEditorFactory);
}

function commandEditTitle(context: ExtensionContext): void {
  const terminalTitleEditorWidget = <TerminalTitleEditorWidget>
    context.window.activeTerminal.openTerminalBorderWidget("edit-title");
  terminalTitleEditorWidget.focus();
}

function tabTitleWidgetFactory(terminal: Terminal, widget: TabTitleWidget): any {
  const templateString = new TemplateString();
  templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
  templateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminal.environment));
  templateString.addFormatter("icon", new IconFormatter());

  const settings = <Settings> terminal.getSessionSettings("title");
  const template = settings?.template ?? "${icon:fas fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}";
  templateString.setTemplateString(template);

  const newDiv = document.createElement("div");
  newDiv.classList.add("tab_title");
  widget.getContainerElement().appendChild(newDiv);

  const boundUpdateTitleFunc = updateTitleFunc.bind(newDiv, templateString);
  terminal.environment.onChange(boundUpdateTitleFunc);
  updateTitleFunc(newDiv, templateString);

  terminalToTemplateMap.set(terminal, { templateString, updateTitleFunc: boundUpdateTitleFunc });
  return null;
}

function updateTitleFunc(newDiv: HTMLDivElement, templateString: TemplateString): void {
  newDiv.innerHTML = templateString.formatHtml();
}

function terminalBorderWidgetFactory(context: ExtensionContext, terminal: Terminal, widget: TerminalBorderWidget): any {
  const tabTitleData = terminalToTemplateMap.get(terminal);
  return new TerminalTitleEditorWidget(context, terminal, widget, tabTitleData.templateString,
    tabTitleData.updateTitleFunc);
}

function sessionSettingsEditorFactory(sessionSettingsEditorBase: SessionSettingsEditorBase): any {
  setupTerminalTitleSessionSettings(sessionSettingsEditorBase);
}
