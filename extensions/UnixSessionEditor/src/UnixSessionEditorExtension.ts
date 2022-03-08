/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import * as fse from "fs-extra";
import * as constants from "constants";

import {ExtensionContext, Logger, SessionConfiguration, SessionEditorBase} from "@extraterm/extraterm-extension-api";
import { Direction, NodeWidget, QComboBox, QLineEdit, QRadioButton, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, GridLayout, LineEdit, RadioButton, setCssClasses, Widget } from "qt-construct";


let log: Logger = null;

interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

let etcShells: string[] = [];

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.sessions.registerSessionEditor("unix", SessionEditorFactory);

  readEtcShells().then(result => {
    etcShells = result;
  });
}

function SessionEditorFactory(sessionEditorBase: SessionEditorBase): NodeWidget<any> {
  return new EditorUi(sessionEditorBase).getWidget();
}

const ETC_SHELLS = "/etc/shells";

class EditorUi {

  #widget: QWidget = null;
  #defaultShellRadioButton: QRadioButton = null;
  #otherRadioButton: QRadioButton = null;
  #otherShellComboBox: QComboBox = null;
  #initialDirectoryLineEdit: QLineEdit = null;

  #sessionEditorBase: SessionEditorBase = null;
  #config: UnixSessionConfiguration = null;

  constructor(sessionEditorBase: SessionEditorBase) {
    this.#sessionEditorBase = sessionEditorBase;
    this.#config = <UnixSessionConfiguration> sessionEditorBase.sessionConfiguration;

    this.#config.args = this.#config.args ?? "";
    this.#config.initialDirectory = this.#config.initialDirectory ?? "";
    this.#config.useDefaultShell = this.#config.useDefaultShell ?? true;
    this.#config.shell = this.#config.shell ?? "";

    const otherShellItems = etcShells.includes(this.#config.shell) ? etcShells : [this.#config.shell, ...etcShells];

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

          "Shell:",
          this.#defaultShellRadioButton = RadioButton({
            checked: this.#config.useDefaultShell,
            text: "Default login shell",
            onClicked: (): void => {
              this.#updateShellRadio(true);
            }
          }),

          "",
          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              children: [
                {
                  widget:
                    this.#otherRadioButton = RadioButton({
                      checked: ! this.#config.useDefaultShell,
                      text: "Other",
                      onClicked: (): void => {
                        this.#updateShellRadio(false);
                      }
                    })
                },
                {
                  widget:
                  this.#otherShellComboBox = ComboBox({
                    enabled: ! this.#config.useDefaultShell,
                    currentIndex: otherShellItems.indexOf(this.#config.shell),
                    editable: true,
                    items: otherShellItems,
                    onCurrentTextChanged: (newText: string): void => {
                      this.#config.shell = newText;
                      this.#checkShellPath(this.#config);
                      sessionEditorBase.setSessionConfiguration(this.#config);
                    }
                  }),
                  stretch: 1
                }
              ]
            })
          }),

          "Arguments:",
          LineEdit({
            text: this.#config.args,
            onTextEdited: (text: string) => {
              this.#config.args = text;
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),

          "Initial Directory:",
          this.#initialDirectoryLineEdit = LineEdit({
            text: this.#config.initialDirectory,
            onTextEdited: (text: string) => {
              this.#config.initialDirectory = text;
              this.#checkInitialDirectory(this.#config);
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
          }),
        ]
      })
    });

    this.#checkShellPath(this.#config);
    this.#checkInitialDirectory(this.#config);
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  #checkShellPath(config: UnixSessionConfiguration): void {
    if ( ! config.useDefaultShell && config.shell !== "") {
      const shellPath = config.shell;

      this.#checkExecutablePath(shellPath).then(resultMsg => {
        if (!config.useDefaultShell && shellPath === config.shell) {
          this.#otherShellComboBox.setToolTip(resultMsg);
          setCssClasses(this.#otherShellComboBox, resultMsg === null ? [] : ["warning"]);
        }
      });
    } else {
      this.#otherShellComboBox.setToolTip(null);
      setCssClasses(this.#otherShellComboBox, []);
    }
  }

  #checkInitialDirectory(config: UnixSessionConfiguration): void {
    if (config.initialDirectory !== "") {
      const initialDirectory = config.initialDirectory;

      this.#checkDirectoryPath(initialDirectory).then(resultMsg => {
        if (initialDirectory === config.initialDirectory) {
          this.#initialDirectoryLineEdit.setToolTip(resultMsg);
          setCssClasses(this.#initialDirectoryLineEdit, resultMsg === null ? [] : ["warning"]);
        }
      });
    } else {
      this.#initialDirectoryLineEdit.setToolTip(null);
      setCssClasses(this.#initialDirectoryLineEdit, []);
    }
  }

  #updateShellRadio(useDefault: boolean): void {
    this.#defaultShellRadioButton.setChecked(useDefault);
    this.#otherRadioButton.setChecked(!useDefault);
    this.#otherShellComboBox.setEnabled(!useDefault);
    if (useDefault) {
      setCssClasses(this.#otherShellComboBox, []);
    }

    this.#config.useDefaultShell = useDefault;
    this.#sessionEditorBase.setSessionConfiguration(this.#config);
  }

  async #checkExecutablePath(exePath: string): Promise<string> {
    try {
      const metadata = await fse.stat(exePath);
      if ( ! metadata.isFile()) {
        return "Path isn't a file";
      }

      await fse.access(exePath, fse.constants.X_OK);
    } catch(err) {
      if (err.errno === -constants.ENOENT) {
        return "Path doesn't exist";
      }
      if (err.errno === -constants.EACCES) {
        return "Path isn't executable";
      }
      return "errno: " +  err.errno + ", err.code: " + err.code;
    }
    return null;
  }

  async #checkDirectoryPath(exePath: string): Promise<string> {
    try {
      const metadata = await fse.stat(exePath);
      if ( ! metadata.isDirectory()) {
        return "Path isn't a directory";
      }

      await fse.access(exePath, fse.constants.R_OK);
    } catch(err) {
      if (err.errno === -constants.ENOENT) {
        return "Path doesn't exist";
      }
      if (err.errno === -constants.EACCES) {
        return "Path isn't readable";
      }
      return "errno: " +  err.errno + ", err.code: " + err.code;
    }
    return "";
  }
}

async function readEtcShells(): Promise<string[]> {
  if (await fse.pathExists(ETC_SHELLS)) {
    const shellText = await fse.readFile("/etc/shells", "utf-8");

    const lines = shellText.split("\n");
    const result: string[] = [];
    for (const line of lines) {
      if ( ! line.startsWith("#") && line.trim() !== "") {
        result.push(line);
      }
    }
    return result;
  } else {
    return [];
  }
}

