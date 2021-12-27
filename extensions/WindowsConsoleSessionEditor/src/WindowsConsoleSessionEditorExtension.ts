/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as fse from 'fs-extra';
import * as constants from 'constants';

import { ExtensionContext, Logger, SessionConfiguration, SessionEditorBase } from '@extraterm/extraterm-extension-api';
import { NodeWidget, QComboBox, QLineEdit, QWidget } from "@nodegui/nodegui";
import { ComboBox, GridLayout, LineEdit, setCssClasses, Widget } from "qt-construct";


let log: Logger = null;

interface WindowsConsoleSessionConfiguration extends SessionConfiguration {
  exe?: string;
}

let commands: string[] = [];

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.window.registerSessionEditor("windows-console", SessionEditorFactory);

  initializeAvailableExes().then(availableCommands => {
    commands = availableCommands;
  });
}

function SessionEditorFactory(sessionEditorBase: SessionEditorBase): NodeWidget<any> {
  return new EditorUi(sessionEditorBase).getWidget();
}

async function checkExe(exe: string): Promise<string> {
  if (path.isAbsolute(exe)) {
    return checkExecutablePath(exe);
  }

  const searchPaths: string[] = process.env.PATH.split(";");
  for (const p of searchPaths) {
    const testPath = path.join(p, exe);
    const result = await checkExecutablePath(testPath);
    if (result === "") {
      return "";
    }
  }
  return "Couldn't find executable";
}

async function checkExecutablePath(exePath: string): Promise<string> {
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
  return "";
}

async function initializeAvailableExes(): Promise<string[]> {
  const availableExes: string[] = [];
  for (const exePath of ["cmd.exe", "powershell.exe", "pwsh.exe"]) {
    const errorMsg = await checkExe(exePath);
    if (errorMsg === "") {
      availableExes.push(exePath);
    }
  }
  return availableExes;
}


class EditorUi {

  #widget: QWidget = null;
  #commandComboBox: QComboBox = null;
  #initialDirectoryLineEdit: QLineEdit = null;
  #config: WindowsConsoleSessionConfiguration = null;

  constructor(sessionEditorBase: SessionEditorBase) {
    this.#config = <WindowsConsoleSessionConfiguration> sessionEditorBase.sessionConfiguration;

    this.#config.args = this.#config.args ?? "";
    this.#config.initialDirectory = this.#config.initialDirectory ?? "";
    this.#config.exe = this.#config.exe ?? "cmd.exe";

    const commandItems = commands.includes(this.#config.exe) ? commands : [this.#config.exe, ...commands];

    this.#widget = Widget({
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

          "Command:",
          this.#commandComboBox = ComboBox({
            currentIndex: commandItems.indexOf(this.#config.exe),
            editable: true,
            items: commandItems,
            onCurrentTextChanged: (newText: string): void => {
              this.#config.exe = newText;
              this.#checkShellPath(this.#config);
              sessionEditorBase.setSessionConfiguration(this.#config);
            }
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

  async #checkShellPath(config: WindowsConsoleSessionConfiguration): Promise<void> {
    const shellPath = config.exe;

    if (path.isAbsolute(shellPath)) {
      const resultMsg = await this.#checkExecutablePath(shellPath);
      if (shellPath === config.exe) {
        this.#commandComboBox.setToolTip(resultMsg);
        setCssClasses(this.#commandComboBox, resultMsg === null ? [] : ["warning"]);
      }
    } else {
      const searchPaths: string[] = process.env.PATH.split(";");
      let resultMsg: string = null;
      for (const p of searchPaths) {
        const testPath = path.join(p, shellPath);
        resultMsg = await this.#checkExecutablePath(testPath);
        if (resultMsg == null) {
          this.#commandComboBox.setToolTip("");
          setCssClasses(this.#commandComboBox, []);
          return;
        }
      }

      this.#commandComboBox.setToolTip(resultMsg);
      setCssClasses(this.#commandComboBox, ["warning"]);
    }
  }

  #checkInitialDirectory(config: WindowsConsoleSessionConfiguration): void {
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
