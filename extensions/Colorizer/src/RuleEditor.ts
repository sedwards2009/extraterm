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
import { BoxLayout, LineEdit, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { Direction, QColor, QPoint, QPushButton, QWidget } from "@nodegui/nodegui";
import { ColorRule } from "./Config.js";
import { ColorPatchButton } from "./ColorPatchButton.js";
import { ColorPatchPopup } from "./ColorPatchPopup.js";


export class RuleEditor {
  #colorRule: ColorRule = null;
  #style: Style = null;
  #patternEditor: QWidget = null;

  #colorPatchPopup: ColorPatchPopup = null;

  #foregroundEditor: ColorPatchButton = null;
  #backgroundEditor: ColorPatchButton = null;
  #styleEditor: QWidget = null;
  #deleteButton: QPushButton = null;

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
    this.#patternEditor = Widget({
      cssClass: ["background"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children: [
          {
            widget: LineEdit({
              text: this.#colorRule.pattern,
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
    this.#foregroundEditor = new ColorPatchButton(false, this.#log);
    this.#foregroundEditor.onClicked(() => {
      const widget = this.#foregroundEditor.getWidget();
      const rect = widget.geometry();
      const bottomLeft = widget.mapToGlobal(new QPoint(0, rect.height()));
      const colorPatchPopupWidget = this.#colorPatchPopup.getWidget();
      this.#colorPatchPopup.setSelectedIndex(this.#colorRule.foreground);

      const dispose = () => {
        onSelectedDisposable.dispose();
        onCloseDisposable.dispose();
      };
      const onSelectedDisposable = this.#colorPatchPopup.onSelected((index: number) => {
        dispose();
        colorPatchPopupWidget.hide();

        this.#colorRule.foreground = index;
        const color = index == null ? null : new QColor(this.#terminalSettings.currentTheme[index]);
        this.#foregroundEditor.setColor(color);
        this.#onChangedEventEmitter.fire();
      });
      const onCloseDisposable = this.#colorPatchPopup.onClosed(dispose);

      const hint = colorPatchPopupWidget.sizeHint();
      colorPatchPopupWidget.setGeometry(bottomLeft.x(), bottomLeft.y(), hint.width(), hint.height());
      colorPatchPopupWidget.raise();
      colorPatchPopupWidget.show();
    });

    const color = this.#colorRule.foreground == null ? null : new QColor(this.#terminalSettings.currentTheme[this.#colorRule.foreground]);
    this.#foregroundEditor.setColor(color);
  }

  #initBackgroundEditor(): void {
    this.#backgroundEditor = new ColorPatchButton(false, this.#log);

    this.#backgroundEditor.setColor(new QColor(this.#terminalSettings.currentTheme[1]));
  }

  #initStyleEditor(): void {
    this.#styleEditor = Widget({
      cssClass: ["background"],
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

    this.#deleteButton = PushButton({
      cssClass: ["microtool", "danger"],
      icon: normalIcon,
      onEnter: () => {
        this.#deleteButton.setIcon(hoverIcon);
      },
      onLeave: () => {
        this.#deleteButton.setIcon(normalIcon);
      },
      toolTip: "Delete",
      onClicked: () => {
        this.#onDeleteClickedEventEmitter.fire(this.#colorRule.uuid);
      }
    });
  }
}
