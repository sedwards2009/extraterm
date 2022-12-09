/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  Logger,
  Style,
  TerminalSettings
} from "@extraterm/extraterm-extension-api";
import { BoxLayout, Frame, LineEdit, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { Direction, QPushButton, QWidget } from "@nodegui/nodegui";
import { ColorRule } from "./Config.js";
import { ColorPatchPopup } from "./ColorPatchPopup.js";
import { ColorPatchSelector } from "./ColorPatchSelector.js";
import { Dir } from "fs-extra";


export class RuleEditor {
  #colorRule: ColorRule = null;
  #style: Style = null;
  #patternEditor: QWidget = null;

  #colorPatchPopup: ColorPatchPopup = null;

  #foregroundEditor: ColorPatchSelector = null;
  #backgroundEditor: ColorPatchSelector = null;

  #styleEditor: QWidget = null;
  #deleteButton: QWidget = null;

  #onChangedEventEmitter = new EventEmitter<void>();
  onChanged: Event<void>;

  #onForegroundClickedEventEmitter = new EventEmitter<void>();
  onForegroundClicked: Event<void>;

  #onBackgroundClickedEventEmitter = new EventEmitter<void>();
  onBackgroundClicked: Event<void>;

  #onDeleteClickedEventEmitter = new EventEmitter<string>();
  onDeleteClicked: Event<string>;

  #terminalSettings: TerminalSettings = null;

  #log: Logger = null;

  constructor(colorRule: ColorRule, terminalSettings: TerminalSettings, colorPatchPopup: ColorPatchPopup,
      style: Style, log: Logger) {
    this.#style = style;
    this.#colorPatchPopup = colorPatchPopup;
    this.#terminalSettings = terminalSettings;
    this.#log = log;
    this.#colorRule = colorRule;
    this.onChanged = this.#onChangedEventEmitter.event;

    this.onForegroundClicked = this.#onForegroundClickedEventEmitter.event;
    this.onBackgroundClicked = this.#onBackgroundClickedEventEmitter.event;
    this.onDeleteClicked = this.#onDeleteClickedEventEmitter.event;

    this.#initPatternEditor();
    this.#initForegroundEditor();
    this.#initBackgroundEditor();
    this.#initDeleteButton();

    this.#initStyleEditor();
  }

  getPatternEditor(): QWidget {
    return this.#patternEditor;
  }

  getForegroundEditor(): QWidget {
    return this.#foregroundEditor.getWidget();
  }

  getBackgroundEditor(): QWidget {
    return this.#backgroundEditor.getWidget();
  }

  getStyleEditor(): QWidget {
    return this.#styleEditor;
  }

  getDeleteButton(): QWidget {
    return this.#deleteButton;
  }

  #initPatternEditor(): void {
    this.#patternEditor = Frame({
      cssClass: ["table-item"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: 0,
        children: [
          {
            widget: LineEdit({
              text: this.#colorRule.pattern,
              placeholderText: "pattern",
              onTextEdited: (newText: string) => {
                this.#patternTextChanged(newText);
              }
            }),
            stretch: 1
          },

          BoxLayout({
            direction: Direction.LeftToRight,
            spacing: 0,
            contentsMargins: [0, 0, 0, 0],
            children: [
              PushButton({
                text: "aA",
                cssClass: ["small", "group-left"],
                checkable: true,
                checked: this.#colorRule.isCaseSensitive,
                onClicked: (checked: boolean) => this.#caseSensitiveChanged(checked)
              }),
              PushButton({
                text: ".*",
                cssClass: ["small", "group-right"],
                checkable: true,
                checked: this.#colorRule.isRegex,
                onClicked: (checked: boolean) => this.#regexChanged(checked)
              })
            ]
          })
        ]
      })
    });
  }

  #patternTextChanged(newText: string):void {
    this.#colorRule.pattern = newText;
    this.#onChangedEventEmitter.fire();
  }

  #caseSensitiveChanged(checked: boolean): void {
    this.#colorRule.isCaseSensitive = checked;
    this.#onChangedEventEmitter.fire();
  }

  #regexChanged(checked: boolean): void {
    this.#colorRule.isRegex = checked;
    this.#onChangedEventEmitter.fire();
  }

  #initForegroundEditor(): void {
    this.#foregroundEditor = new ColorPatchSelector(this.#terminalSettings.currentTheme, this.#colorPatchPopup,
      this.#log);
    this.#foregroundEditor.onChanged((index: number | null) => {
      this.#colorRule.foreground = index;
      this.#onChangedEventEmitter.fire();
    });
    this.#foregroundEditor.setColorIndex(this.#colorRule.foreground);
  }

  #initBackgroundEditor(): void {
    this.#backgroundEditor = new ColorPatchSelector(this.#terminalSettings.currentTheme, this.#colorPatchPopup,
      this.#log);
    this.#backgroundEditor.onChanged((index: number | null) => {
      this.#colorRule.background = index;
      this.#onChangedEventEmitter.fire();
    });
    this.#backgroundEditor.setColorIndex(this.#colorRule.background);
  }

  #initStyleEditor(): void {
    this.#styleEditor = Frame({
      cssClass: ["table-item"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        spacing: 0,
        contentsMargins: [0, 0, 0, 0],
        children: [
          PushButton({
            text: "Bold",
            cssClass: ["small", "group-left"],
            checkable: true,
            checked: this.#colorRule.isBold,
            onClicked: (checked: boolean) => {
              this.#colorRule.isBold = checked;
              this.#onChangedEventEmitter.fire();
            }
          }),
          PushButton({
            text: "Italic",
            cssClass: ["small", "group-middle"],
            checkable: true,
            checked: this.#colorRule.isItalic,
            onClicked: (checked: boolean) => {
              this.#colorRule.isItalic = checked;
              this.#onChangedEventEmitter.fire();
            }
          }),
          PushButton({
            text: "Underline",
            cssClass: ["small", "group-right"],
            checkable: true,
            checked: this.#colorRule.isUnderline,
            onClicked: (checked: boolean) => {
              this.#colorRule.isUnderline = checked;
              this.#onChangedEventEmitter.fire();
            }
          })
        ]
      })
    });
  }

  #initDeleteButton(): void {
    const normalIcon = this.#style.createQIcon("fa-times", this.#style.palette.text);
    const hoverIcon = this.#style.createQIcon("fa-times", this.#style.palette.background);

    let button: QPushButton = null;
    this.#deleteButton = Frame({
      cssClass: ["table-item"],
      contentsMargins: 0,
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: 0,
        children: [
          button = PushButton({
            cssClass: ["microtool", "danger", "table-item"],
            icon: normalIcon,
            onEnter: () => {
              button.setIcon(hoverIcon);
            },
            onLeave: () => {
              button.setIcon(normalIcon);
            },
            toolTip: "Delete",
            onClicked: () => {
              this.#onDeleteClickedEventEmitter.fire(this.#colorRule.uuid);
            }
          })
        ]
      })
    });
  }
}
