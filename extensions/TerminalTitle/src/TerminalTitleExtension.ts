/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalEnvironment, SessionSettingsEditorBase } from '@extraterm/extraterm-extension-api';
import { NodeWidget, QLabel, QSizePolicyPolicy, TextFormat } from '@nodegui/nodegui';
import { Label } from 'qt-construct';
import { HtmlIconFormatter } from './HtmlIconFormatter';
// import { TerminalTitleEditorWidget} from "./TerminalTitleEditorWidget";
import { TemplateString } from './TemplateString';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
// import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
import { createTerminalTitleSessionSettings, Settings } from './TerminalTitleSessionSettings';

let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
}

const terminalToTemplateMap = new WeakMap<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;
  // context.commands.registerCommand("terminal-title:editTitle", commandEditTitle.bind(null, context));
  context.windows.registerTabTitleWidget("title", tabTitleWidgetFactory);
  // context.registerTerminalBorderWidget("edit-title", terminalBorderWidgetFactory.bind(null, context));
  context.sessions.registerSessionSettingsEditor("title",
    (sessionSettingsEditorBase: SessionSettingsEditorBase): NodeWidget<any> => {
      return createTerminalTitleSessionSettings(sessionSettingsEditorBase, log);
    }
  );
}
/*
function commandEditTitle(context: ExtensionContext): void {
  const terminalTitleEditorWidget = <TerminalTitleEditorWidget>
    context.activeTerminal.openTerminalBorderWidget("edit-title");
  terminalTitleEditorWidget.focus();
}
*/
function tabTitleWidgetFactory(terminal: Terminal): QLabel {
  const templateString = new TemplateString();
  templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
  templateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminal.environment));
  templateString.addFormatter("icon", new HtmlIconFormatter(terminal.tab.window.style));

  const settings = <Settings> terminal.getSessionSettings("title");
  const template = settings?.template ?? "${icon:fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}";
  templateString.setTemplateString(template);

  const widget = Label({
    sizePolicy: {
      horizontal: QSizePolicyPolicy.Expanding,
      vertical: QSizePolicyPolicy.Fixed,
    },
    textFormat: TextFormat.RichText,
    text: ""
  });

  const boundUpdateTitleFunc = updateTitleFunc.bind(null, widget, templateString);
  terminal.environment.onChange(boundUpdateTitleFunc);
  updateTitleFunc(widget, templateString);

  terminalToTemplateMap.set(terminal, { templateString, updateTitleFunc: boundUpdateTitleFunc });
  return widget;
}

function updateTitleFunc(widget: QLabel, templateString: TemplateString): void {
  widget.setText(templateString.formatHtml());
}
/*
function terminalBorderWidgetFactory(context: ExtensionContext, terminal: Terminal, widget: TerminalBorderWidget): any {
  const tabTitleData = terminalToTemplateMap.get(terminal);
  return new TerminalTitleEditorWidget(context, terminal, widget, tabTitleData.templateString,
    tabTitleData.updateTitleFunc);
}
*/
