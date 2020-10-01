/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { SessionSettingsEditorBase, TerminalEnvironment } from '@extraterm/extraterm-extension-api';
import { TemplateString, Segment } from './TemplateString';
import { TemplateEditorComponent } from "./TemplateEditorComponent";
import { IconFormatter } from './IconFormatter';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter';


export interface Settings {
  template?: string;
}

export function setupTerminalTitleSessionSettings(sessionSettingsEditorBase: SessionSettingsEditorBase) {
  const templateString = new TemplateString();

  const terminalEnvironment = new Map<string, string>();
  terminalEnvironment.set(TerminalEnvironment.TERM_TITLE, "~/");
  terminalEnvironment.set(TerminalEnvironment.TERM_ROWS, "24");
  terminalEnvironment.set(TerminalEnvironment.TERM_COLUMNS, "80");
  terminalEnvironment.set(TerminalEnvironment.COMMAND_CURRENT, "dir");
  terminalEnvironment.set(TerminalEnvironment.COMMAND_LAST, "cd");
  terminalEnvironment.set(TerminalEnvironment.COMMAND_EXIT_CODE, "0");

  templateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminalEnvironment));
  templateString.addFormatter("icon", new IconFormatter());

  const ui = new TemplateEditorComponent();
  const component = ui.$mount();
  const settings = <Settings> sessionSettingsEditorBase.getSettings();

  if (settings.template == null) {
    settings.template = "${icon:fas fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}";
    sessionSettingsEditorBase.setSettings(settings);
  }

  templateString.setTemplateString(settings.template);

  sessionSettingsEditorBase.getContainerElement().appendChild(component.$el);

  ui.template = templateString.getTemplateString();
  ui.segments = templateString.getSegments();
  ui.segmentHtml = templateString.getSegmentHtmlList();

  ui.$on("template-change", (template: string) => {
    settings.template = template;
    sessionSettingsEditorBase.setSettings(settings);

    templateString.setTemplateString(template);
    ui.segments = templateString.getSegments();
    ui.segmentHtml = templateString.getSegmentHtmlList();
  });
}
