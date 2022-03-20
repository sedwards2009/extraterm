/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, SessionSettingsEditorBase, TerminalEnvironment } from '@extraterm/extraterm-extension-api';

import { TemplateString } from './TemplateString';
import { IconFormatter } from './IconFormatter';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';
import { NodeWidget } from '@nodegui/nodegui';
import { TemplateEditor } from './TemplateEditor';


export interface Settings {
  template?: string;
}

export function createTerminalTitleSessionSettings(sessionSettingsEditorBase: SessionSettingsEditorBase,
    log: Logger): NodeWidget<any> {

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
  templateString.addFormatter("icon", new IconFormatter(sessionSettingsEditorBase.style));

  const settings = <Settings> sessionSettingsEditorBase.settings;
  if (settings.template == null) {
    settings.template = "${icon:fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}";
    sessionSettingsEditorBase.setSettings(settings);
  }
  templateString.setTemplateString(settings.template);

  const templateEditor = new TemplateEditor(templateString, sessionSettingsEditorBase.style, log);
  templateEditor.onTemplateChanged((template: string) => {
    settings.template = template;
    sessionSettingsEditorBase.setSettings(settings);
  });
  return templateEditor.getWidget();
}
