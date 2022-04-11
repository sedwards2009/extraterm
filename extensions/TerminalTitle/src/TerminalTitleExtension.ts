/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalEnvironment,
  SessionSettingsEditorBase } from '@extraterm/extraterm-extension-api';
import { NodeWidget, QLabel, QSizePolicyPolicy, TextFormat } from '@nodegui/nodegui';
import { Label } from 'qt-construct';
import { IconFormatter } from './IconFormatter.js';
import { TemplateString } from './TemplateString.js';
import { TerminalBorderEditor } from './TerminalBorderEditor.js';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter.js';
import { createTerminalTitleSessionSettings, Settings } from './TerminalTitleSessionSettings.js';


let log: Logger = null;

interface TabTitleData {
  templateString: TemplateString;
  updateTitleFunc: () => void;
  borderWidget: TerminalBorderWidget;
  terminalBorderEditor: TerminalBorderEditor;
}

const terminalToTemplateMap = new WeakMap<Terminal, TabTitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.commands.registerCommand("terminal-title:editTitle", commandEditTitle.bind(null, context));
  context.windows.registerTabTitleWidget("title", tabTitleWidgetFactory);
  context.sessions.registerSessionSettingsEditor("title",
    (sessionSettingsEditorBase: SessionSettingsEditorBase): NodeWidget<any> => {
      return createTerminalTitleSessionSettings(sessionSettingsEditorBase, log);
    }
  );
}

function commandEditTitle(context: ExtensionContext): void {
  const terminal = context.activeTerminal;
  const tabTitleData = terminalToTemplateMap.get(terminal);
  if (tabTitleData.borderWidget == null) {
    tabTitleData.borderWidget = terminal.createTerminalBorderWidget("edit-title");
    tabTitleData.terminalBorderEditor = new TerminalBorderEditor(tabTitleData.templateString,
      terminal.tab.window.style, log);
    tabTitleData.terminalBorderEditor.onTemplateChanged(() => {
      tabTitleData.updateTitleFunc();
    });
    tabTitleData.terminalBorderEditor.onDone(() => {
      tabTitleData.borderWidget.close();
    });
    tabTitleData.borderWidget.contentWidget = tabTitleData.terminalBorderEditor.getWidget();
  }
  tabTitleData.terminalBorderEditor.prepareToOpen();

  tabTitleData.borderWidget.open();
  tabTitleData.terminalBorderEditor.focus();
}

function tabTitleWidgetFactory(terminal: Terminal): QLabel {
  const templateString = new TemplateString();
  templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
  templateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminal.environment));
  templateString.addFormatter("icon", new IconFormatter(terminal.tab.window.style));

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

  terminalToTemplateMap.set(terminal, {
    templateString,
    updateTitleFunc: boundUpdateTitleFunc,
    borderWidget: null,
    terminalBorderEditor: null
  });
  return widget;
}

function updateTitleFunc(widget: QLabel, templateString: TemplateString): void {
  widget.setText(templateString.formatHtml());
}
