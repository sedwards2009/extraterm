/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Logger, Style } from '@extraterm/extraterm-extension-api';
import { AlignmentFlag, Direction, FocusReason, Key, QKeyEvent, QLineEdit, QPushButton, QWidget, TextFormat } from '@nodegui/nodegui';
import { BoxLayout, Label, LineEdit, PushButton, Widget } from 'qt-construct';
import { EventEmitter } from "extraterm-event-emitter";


export class FindControls {
  #log: Logger;
  #rootWidget: QWidget = null;
  #style: Style;
  #lineEdit: QLineEdit = null;
  #caseSensitiveButton: QPushButton = null;
  #regexButton: QPushButton = null;

  #onCloseRequestEventEmitter = new EventEmitter<void>();
  onCloseRequest: Event<void> = null;

  #onSearchTextChangedEventEmitter = new EventEmitter<string>();
  onSearchTextChanged: Event<string> = null;

  #onCaseSensitiveChangedEventEmitter = new EventEmitter<boolean>();
  onCaseSensitiveChanged: Event<boolean>;

  #onRegexChangedEventEmitter = new EventEmitter<boolean>();
  onRegexChanged: Event<boolean>;

  #onSearchBackwardsClickedEventEmitter = new EventEmitter<void>();
  onSearchBackwardsClicked: Event<void>;

  #onSearchForwardsClickedEventEmitter = new EventEmitter<void>();
  onSearchForwardsClicked: Event<void>;

  constructor(style: Style, log: Logger) {
    this.#log = log;
    this.#style = style;
    this.onCloseRequest = this.#onCloseRequestEventEmitter.event;
    this.onSearchTextChanged = this.#onSearchTextChangedEventEmitter.event;
    this.onCaseSensitiveChanged = this.#onCaseSensitiveChangedEventEmitter.event;
    this.onRegexChanged = this.#onRegexChangedEventEmitter.event;

    this.onSearchBackwardsClicked = this.#onSearchBackwardsClickedEventEmitter.event;
    this.onSearchForwardsClicked = this.#onSearchForwardsClickedEventEmitter.event;

    this.#rootWidget = this.#createGUI();
  }

  #createGUI(): QWidget {
    return Widget({
      cssClass: ["background"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children: [
          Label({
            textFormat: TextFormat.RichText,
            text: this.#style.createHtmlIcon("fa-search")
          }),
          {
            widget: this.#lineEdit = LineEdit({
              text: "",
              onTextEdited: (newText: string) => {
                this.#searchTextChanged(newText);
              },
              onKeyPress: (nativeEvent) => this.#onKeyPress(nativeEvent)
            }),
            stretch: 1
          },

          BoxLayout({
            direction: Direction.LeftToRight,
            spacing: 0,
            contentsMargins: [0, 0, 0, 0],
            children: [
              this.#caseSensitiveButton = PushButton({
                text: "aA",
                cssClass: ["small", "group-left"],
                checkable: true,
                checked: false,
                onClicked: (checked: boolean) => this.#caseSensitiveChanged(checked)
              }),
              this.#regexButton = PushButton({
                text: ".*",
                cssClass: ["small", "group-right"],
                checkable: true,
                checked: false,
                onClicked: (checked: boolean) => this.#regexChanged(checked)
              })
            ]
          }),

          BoxLayout({
            direction: Direction.LeftToRight,
            spacing: 0,
            contentsMargins: [0, 0, 0, 0],
            children: [
              this.#caseSensitiveButton = PushButton({
                icon: this.#style.createQIcon("fa-arrow-up"),
                cssClass: ["small", "group-left"],
                onClicked: () => this.#searchBackwards()
              }),
              this.#regexButton = PushButton({
                icon: this.#style.createQIcon("fa-arrow-down"),
                cssClass: ["small", "group-right"],
                onClicked: () => this.#searchForwards()
              })
            ]
          }),

          {
            widget: PushButton({
              cssClass: ["small", "danger"],
              icon: this.#style.createQIcon("fa-times", this.#style.palette.textHighlight),
              onClicked: () => {
                this.#handleClose();
              }
            }),
            alignment: AlignmentFlag.AlignTop,
            stretch: 0
          }
        ]
      })
    });
  }

  getWidget(): QWidget {
    return this.#rootWidget;
  }

  focus(): void {
    this.#lineEdit.setFocus(FocusReason.OtherFocusReason);
  }

  getSearchText(): string {
    return this.#lineEdit.text();
  }

  isCaseSensitive(): boolean {
    return this.#caseSensitiveButton.isChecked();
  }

  isRegex(): boolean {
    return this.#regexButton.isChecked();
  }

  #onKeyPress(nativeEvent): void {
    const event = new QKeyEvent(nativeEvent);

    const key = event.key();
    if( ! [Key.Key_Escape, Key.Key_Enter, Key.Key_Return].includes(key)) {
      return;
    }

    event.accept();
    this.#lineEdit.setEventProcessed(true);

    if(key === Key.Key_Escape) {
      this.#handleClose();
    } else {
      this.#searchBackwards();
    }
  }

  #handleClose(): void {
    this.#onCloseRequestEventEmitter.fire();
  }

  #searchTextChanged(text: string): void {
    this.#onSearchTextChangedEventEmitter.fire(text);
  }

  #caseSensitiveChanged(checked: boolean): void {
    this.#onCaseSensitiveChangedEventEmitter.fire(checked);
  }

  #regexChanged(checked: boolean): void {
    this.#onRegexChangedEventEmitter.fire(checked);
  }

  #searchBackwards(): void {
    this.#onSearchBackwardsClickedEventEmitter.fire();
  }

  #searchForwards(): void {
    this.#onSearchForwardsClickedEventEmitter.fire();
  }
}
