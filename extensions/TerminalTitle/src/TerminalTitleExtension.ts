/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalEnvironment,
  SessionSettingsEditorBase } from '@extraterm/extraterm-extension-api';
import { QWidget, QLabel, QSizePolicyPolicy, TextFormat } from '@nodegui/nodegui';
import { Label } from 'qt-construct';
import { IconFormatter } from './IconFormatter.js';
import { TemplateEditorOptions } from './TemplateEditor.js';
import { TemplateString } from './TemplateString.js';
import { TerminalBorderEditor } from './TerminalBorderEditor.js';
import { TerminalEnvironmentFormatter } from './TerminalEnvironmentFormatter.js';
import { createTerminalTitleSessionSettings, TitleSettings } from './TerminalTitleSessionSettings.js';
import { createTerminalWindowTitleSessionSettings } from './TerminalWindowTitleSessionSettings.js';


let log: Logger = null;

interface TitleData {
  tabTitleTemplateString: TemplateString;
  windowTitleTemplateString: TemplateString;
  updateTitleFunc: () => void;

  borderTabTitleEditor: BorderTitleEditor;
  borderWindowTitleEditor: BorderTitleEditor;
}

const terminalToTemplateMap = new WeakMap<Terminal, TitleData>();


export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.commands.registerCommand("terminal-title:editTitle", commandEditTabTitle.bind(null, context));
  context.commands.registerCommand("terminal-title:editWindowTitle", commandEditWindowTitle.bind(null, context));

  context.windows.registerTabTitleWidget("title", tabTitleWidgetFactory);
  context.sessions.registerSessionSettingsEditor("title",
    (sessionSettingsEditorBase: SessionSettingsEditorBase): QWidget => {
      return createTerminalTitleSessionSettings(sessionSettingsEditorBase, log);
    }
  );
  context.sessions.registerSessionSettingsEditor("window-title",
    (sessionSettingsEditorBase: SessionSettingsEditorBase): QWidget => {
      return createTerminalWindowTitleSessionSettings(sessionSettingsEditorBase, log);
    }
  );
}

function commandEditTabTitle(context: ExtensionContext): void {
  const terminal = context.activeTerminal;
  const tabTitleData = terminalToTemplateMap.get(terminal);
  tabTitleData.borderTabTitleEditor.open();
}

function commandEditWindowTitle(context: ExtensionContext): void {
  const terminal = context.activeTerminal;
  const tabTitleData = terminalToTemplateMap.get(terminal);
  tabTitleData.borderWindowTitleEditor.open();
}

function tabTitleWidgetFactory(terminal: Terminal): QLabel {
  const tabTemplateString = new TemplateString();
  tabTemplateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
  tabTemplateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminal.environment));
  tabTemplateString.addFormatter("icon", new IconFormatter(terminal.tab.window.style));

  if (terminal.isConnected) {
    const tabTitleSettings = <TitleSettings> terminal.getSessionSettings("title");
    const tabTemplate = tabTitleSettings?.template ?? "${icon:fa-keyboard} ${" + TerminalEnvironment.TERM_TITLE + "}";
    tabTemplateString.setTemplateString(tabTemplate);
  } else {
    const exitCode = terminal.environment.get(TerminalEnvironment.EXTRATERM_EXIT_CODE);
    const icon = exitCode === "0" ? "fa-check" : "fa-times";
    const tabTemplate = `\${icon:${icon}} \${${TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE}}`;
    tabTemplateString.setTemplateString(tabTemplate);
  }

  const windowTitleTemplateString = new TemplateString();
  windowTitleTemplateString.addFormatter("term", new TerminalEnvironmentFormatter("term", terminal.environment));
  windowTitleTemplateString.addFormatter("extraterm", new TerminalEnvironmentFormatter("extraterm", terminal.environment));

  if (terminal.isConnected) {
    const windowTitleSettings = <TitleSettings> terminal.getSessionSettings("window-title");
    const windowTitleTemplate = windowTitleSettings?.template ?? "${" + TerminalEnvironment.TERM_TITLE + "}";
    windowTitleTemplateString.setTemplateString(windowTitleTemplate);
  } else {
    const tabTemplate = `\${${TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE}}`;
    windowTitleTemplateString.setTemplateString(tabTemplate);
  }

  const widget = Label({
    sizePolicy: {
      horizontal: QSizePolicyPolicy.Expanding,
      vertical: QSizePolicyPolicy.Fixed,
    },
    textFormat: TextFormat.RichText,
    text: ""
  });

  const boundUpdateTitleFunc = updateTitleFunc.bind(null, terminal, widget, tabTemplateString,
    windowTitleTemplateString);
  terminal.environment.onChange(boundUpdateTitleFunc);
  updateTitleFunc(terminal, widget, tabTemplateString, windowTitleTemplateString);

  terminalToTemplateMap.set(terminal, {
    tabTitleTemplateString: tabTemplateString,
    windowTitleTemplateString: windowTitleTemplateString,
    updateTitleFunc: boundUpdateTitleFunc,

    borderTabTitleEditor: new BorderTabTitleEditor(terminal, tabTemplateString, boundUpdateTitleFunc),
    borderWindowTitleEditor: new BorderWindowTitleEditor(terminal, windowTitleTemplateString, boundUpdateTitleFunc),
  });
  return widget;
}

function updateTitleFunc(terminal: Terminal, widget: QLabel, tabTemplateString: TemplateString,
    windowTitleTemplateString: TemplateString): void {

  widget.setText(tabTemplateString.formatHtml());
  terminal.tab.windowTitle = windowTitleTemplateString.formatText();
}


class BorderTitleEditor {
  #borderWidgetName: string = null;
  #templateString: TemplateString = null;
  #terminalBorderEditor: TerminalBorderEditor = null;
  #tabTitleBorderWidget: TerminalBorderWidget = null;
  #terminal: Terminal = null;
  #updateTitleFunc: () => void = null;

  constructor(terminal: Terminal, borderWidgetName: string, templateString: TemplateString, updateTitleFunc: () => void) {
    this.#borderWidgetName = borderWidgetName;
    this.#templateString = templateString;
    this.#terminal = terminal;
    this.#updateTitleFunc = updateTitleFunc;
  }

  open(): void {
    if (this.#tabTitleBorderWidget == null) {
      this.#tabTitleBorderWidget = this.#terminal.createTerminalBorderWidget(this.#borderWidgetName);
      this.#terminalBorderEditor = new TerminalBorderEditor(this.#templateString,
        this.#terminal.tab.window.style, log, this._getTemplateEditorOptions());
      this.#terminalBorderEditor.onTemplateChanged(() => {
        this.#updateTitleFunc();
      });
      this.#terminalBorderEditor.onDone(() => {
        this.#tabTitleBorderWidget.close();
      });
      this.#tabTitleBorderWidget.contentWidget = this.#terminalBorderEditor.getWidget();
    }
    this.#terminalBorderEditor.prepareToOpen();

    this.#tabTitleBorderWidget.open();
    this.#terminalBorderEditor.focus();
  }

  protected _getTemplateEditorOptions(): TemplateEditorOptions {
    return {
      title: " Tab Title:"
    };
  }
}

class BorderTabTitleEditor extends BorderTitleEditor {
  constructor(terminal: Terminal, templateString: TemplateString, updateTitleFunc: () => void) {
    super(terminal, "edit-title", templateString, updateTitleFunc);
  }
}

class BorderWindowTitleEditor extends BorderTitleEditor {
  constructor(terminal: Terminal, templateString: TemplateString, updateTitleFunc: () => void) {
    super(terminal, "edit-window-title", templateString, updateTitleFunc);
  }
  protected _getTemplateEditorOptions(): TemplateEditorOptions {
    return {
      icons: false,
      title: " Window Title:"
    };
  }
}
