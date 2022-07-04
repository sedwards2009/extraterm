/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from '@nodegui/nodegui';
import { Logger, SessionSettingsEditorBase, TerminalEnvironment } from '@extraterm/extraterm-extension-api';

import { TemplateString } from './TemplateString.js';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter.js';
import { TemplateEditor } from './TemplateEditor.js';


export interface WindowTitleSettings {
  template?: string;
}

export function createTerminalWindowTitleSessionSettings(sessionSettingsEditorBase: SessionSettingsEditorBase,
    log: Logger): QWidget {

  const templateString = new TemplateString();

  const terminalEnvironment = new Map<string, string>();
  terminalEnvironment.set(TerminalEnvironment.TERM_TITLE, "~/");
  terminalEnvironment.set(TerminalEnvironment.TERM_ROWS, "24");
  terminalEnvironment.set(TerminalEnvironment.TERM_COLUMNS, "80");
  terminalEnvironment.set(TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, "dir");
  terminalEnvironment.set(TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, "dir *.txt");
  terminalEnvironment.set(TerminalEnvironment.EXTRATERM_LAST_COMMAND, "cd");
  terminalEnvironment.set(TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, "cd ..");
  terminalEnvironment.set(TerminalEnvironment.EXTRATERM_EXIT_CODE, "0");

  templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminalEnvironment));
  templateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminalEnvironment));

  const settings = <WindowTitleSettings> sessionSettingsEditorBase.settings;
  if (settings.template == null) {
    settings.template = "${" + TerminalEnvironment.TERM_TITLE + "}";
    sessionSettingsEditorBase.setSettings(settings);
  }
  templateString.setTemplateString(settings.template);

  const templateEditor = new TemplateEditor(templateString, sessionSettingsEditorBase.style, log,
    {
      icons: false,
      title: ""
    });
  templateEditor.onTemplateChanged((template: string) => {
    settings.template = template;
    sessionSettingsEditorBase.setSettings(settings);
  });
  return templateEditor.getWidget();
}
