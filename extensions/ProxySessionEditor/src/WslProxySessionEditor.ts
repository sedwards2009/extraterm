/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash-es";
import * as child_process from "node:child_process";

import { Logger, SessionConfiguration, SessionEditorBase } from "@extraterm/extraterm-extension-api";
import { Direction, QComboBox, QLineEdit, QRadioButton, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, GridLayout, LineEdit, RadioButton, setCssClasses, Widget } from "qt-construct";


interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  distribution?: string;
}

export function init(): void {
  readEtcShellsSpawn();
  readDistributionsSpawn();
}

export function wslProxySessionEditorFactory(log: Logger, sessionEditorBase: SessionEditorBase): QWidget {
  return new EditorUi(sessionEditorBase).getWidget();
}

let etcShells: string[] = [];

function readEtcShellsSpawn(): void {
  spawnWsl(["cat", "/etc/shells"], "utf8", splitEtcShells);
}

function spawnWsl(parameters: string[], encoding: string, onExit: (text: string) => void): void {
  // For some reason child_process.exec() doesn't want to work properly on Windows.
  // spawn still does though, but it is a bit more fiddly to use.
  const wslProcess = child_process.spawn("wsl.exe", parameters, {shell: false, stdio: "pipe"});

  let text = "";
  wslProcess.stdout.on("data", data => {
    text += data.toString(encoding);
  });
  wslProcess.on("exit", (msg) => {
    onExit(text);
  });
  wslProcess.stdin.end();
}

function splitEtcShells(shellText: string): void {
  const lines = shellText.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ( ! line.startsWith("#") && line.trim() !== "") {
      result.push(line);
    }
  }
  etcShells = result;
}

let distributions: string[] = [];

function readDistributionsSpawn(): void {
  spawnWsl(["--list"], "utf16le", splitDistributions);
}

function splitDistributions(text: string): void {
  const lines = text.split("\n");
  const result: string[] = [""];
  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      continue;
    }
    const parts = line.split(" ");
    result.push(parts[0].trim());
  }
  distributions = result;
}
const DEFAULT_DISTRO = "<Default>";

class EditorUi {

  #widget: QWidget = null;
  #defaultShellRadioButton: QRadioButton = null;
  #otherRadioButton: QRadioButton = null;
  #otherShellComboBox: QComboBox = null;
  #initialDirectoryLineEdit: QLineEdit = null;

  #sessionEditorBase: SessionEditorBase = null;
  #config: WslProxySessionConfiguration = null;

  constructor(sessionEditorBase: SessionEditorBase) {
    this.#sessionEditorBase = sessionEditorBase;
    this.#config = <WslProxySessionConfiguration> sessionEditorBase.sessionConfiguration;

    this.#config.args = this.#config.args ?? "";
    this.#config.initialDirectory = this.#config.initialDirectory ?? "";
    this.#config.distribution = this.#config.distribution ?? "";
    this.#config.useDefaultShell = this.#config.useDefaultShell ?? true;
    this.#config.shell = this.#config.shell ?? "";

    const otherShellItems = etcShells.includes(this.#config.shell) ? etcShells : [this.#config.shell, ...etcShells];

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

          "Distribution:",
          ComboBox({
            currentIndex: distributions.indexOf(this.#config.distribution),
            items: [DEFAULT_DISTRO, ...distributions.slice(1)],
            onCurrentTextChanged: (newText: string): void => {
              if (newText === DEFAULT_DISTRO) {
                this.#config.distribution = "";
              } else {
                this.#config.distribution = newText;
              }
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
}
