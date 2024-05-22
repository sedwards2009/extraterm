/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, Logger, SessionConfiguration, SessionEditorBase} from "@extraterm/extraterm-extension-api";
import { Direction, QComboBox, QLineEdit, QRadioButton, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, GridLayout, LineEdit, SpinBox, setCssClasses, Widget } from "qt-construct";


let log: Logger = null;

interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.sessions.registerSessionEditor("ssh", SessionEditorFactory);
}

function SessionEditorFactory(sessionEditorBase: SessionEditorBase): QWidget {
  return new EditorUi(sessionEditorBase).getWidget();
}

class EditorUi {

  #widget: QWidget = null;
  #config: SSHSessionConfiguration = null;

  constructor(sessionEditorBase: SessionEditorBase) {
    this.#config = <SSHSessionConfiguration> sessionEditorBase.sessionConfiguration;

    this.#config.port = this.#config.port ?? 22;
    this.#config.host = this.#config.host ?? "";

    this.#widget = Widget({
      contentsMargins: 0,
      layout: GridLayout({
        columns: 2,
        contentsMargins: [0, 0, 0, 0],
        children: [
          "Name:",
          LineEdit({
            text: this.#config.name,
            onTextEdited: (text: string) => {
              this.#config.name = text;
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),

          "Host:",
          LineEdit({
            text: this.#config.host,
            onTextEdited: (text: string) => {
              this.#config.host = text;
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),

          "Port:",
          SpinBox({
            value: this.#config.port,
            minimum: 1,
            maximum: 65535,
            onValueChanged: (value: number) => {
              this.#config.port = value;
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),

          "Username:",
          LineEdit({
            text: this.#config.username,
            onTextEdited: (text: string) => {
              this.#config.username = text;
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),
        ]
      })
    });
  }

  getWidget(): QWidget {
    return this.#widget;
  }
}
