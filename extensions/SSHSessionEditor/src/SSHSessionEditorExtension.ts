/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, Logger, SessionConfiguration, SessionEditorBase} from "@extraterm/extraterm-extension-api";
import { Direction, FileMode, QFileDialog, QLineEdit, QPushButton, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, GridLayout, LineEdit, SpinBox, Widget, PushButton, CheckBox } from "qt-construct";


let log: Logger = null;

// Note: This is duplicated in SSHSessionBackendExtension.ts.
enum AuthenticationMethod {
  DEFAULT_KEYS_PASSWORD,
  PASSWORD_ONLY,
  KEY_FILE_ONLY,
  SSH_AGENT_ONLY,
};

const AUTHENTICATION_METHOD_LABELS = [
  "SSH Agent, Default OpenSSH keys, Password",
  "Password only",
  "Key file only",
  "SSH Agent only"
];

// Note: This is duplicated in SSHSessionBackendExtension.ts.
interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  authenicationMethod?: AuthenticationMethod; // TODO: remove this it has a typo.
  authenticationMethod?: AuthenticationMethod;
  keyFilePath?: string;
  verboseLogging?: boolean;
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
  #sessionEditorBase: SessionEditorBase = null;

  #config: SSHSessionConfiguration = null;
  #selectedKeyFileLineEdit: QLineEdit = null;
  #selectKeyFileButton: QPushButton = null;

  #fileDialog: QFileDialog = null;

  constructor(sessionEditorBase: SessionEditorBase) {
    this.#sessionEditorBase = sessionEditorBase;
    this.#config = <SSHSessionConfiguration> sessionEditorBase.sessionConfiguration;

    // Move the typo to the correct field.
    if (this.#config.authenticationMethod == null) {
      this.#config.authenticationMethod = this.#config.authenicationMethod;
    }
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

          "Authentication:",
          ComboBox({
            currentIndex: this.#config.authenticationMethod ?? AuthenticationMethod.DEFAULT_KEYS_PASSWORD,
            items: AUTHENTICATION_METHOD_LABELS,
            onCurrentIndexChanged: (index: number): void => {
              this.#config.authenticationMethod = index;
              sessionEditorBase.setSessionConfiguration(this.#config);
              this.#updateKeyFileLabel();
            }
          }),

          "",
          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              children: [
                {
                  widget: this.#selectedKeyFileLineEdit = LineEdit({
                    onTextEdited: (text: string) => {
                      this.#handleKeyFilePathChanged(text);
                    },
                    text: this.#config.keyFilePath ?? ""
                  }),
                  stretch: 1,
                },
                {
                  widget: this.#selectKeyFileButton = PushButton({
                    text: "Select Key File",
                    cssClass: ["small"],
                    onClicked: (): void => {
                      this.#handleSelectKeyFile();
                    },
                    enabled: this.#config.authenticationMethod === AuthenticationMethod.KEY_FILE_ONLY,
                  }),
                  stretch: 0,
                }
              ]
            })
          }),

          "",
          CheckBox({
            text: "Verbose logging",
            checked: this.#config.verboseLogging ?? false,
            onStateChanged: (enabled: number) => {
              this.#handleVerboseLoggingChanged(enabled !== 0);
            }
          }),
        ]
      })
    });
    this.#updateKeyFileLabel();
  }

  #updateKeyFileLabel(): void {
    this.#selectedKeyFileLineEdit.setText(this.#config.keyFilePath ?? "");
    const enabled = this.#config.authenticationMethod === AuthenticationMethod.KEY_FILE_ONLY;
    this.#selectedKeyFileLineEdit.setEnabled(enabled);
    this.#selectKeyFileButton.setEnabled(enabled);
  }

  #handleSelectKeyFile(): void {
    this.#fileDialog = new QFileDialog(this.#widget.window(), "Select private key file");
    this.#fileDialog.setFileMode(FileMode.AnyFile);
    this.#fileDialog.exec();

    const selectedFiles = this.#fileDialog.selectedFiles();
    this.#config.keyFilePath = selectedFiles.length === 0 ? null : selectedFiles[0];
    this.#sessionEditorBase.setSessionConfiguration(this.#config);
    this.#updateKeyFileLabel();
  }

  #handleKeyFilePathChanged(keyFilePath: string): void {
    this.#config.keyFilePath = keyFilePath;
    this.#sessionEditorBase.setSessionConfiguration(this.#config);
  }

  #handleVerboseLoggingChanged(enabled: boolean): void {
    this.#config.verboseLogging = enabled;
    this.#sessionEditorBase.setSessionConfiguration(this.#config);
  }

  getWidget(): QWidget {
    return this.#widget;
  }
}
