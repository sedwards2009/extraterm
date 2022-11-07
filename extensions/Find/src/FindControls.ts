/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Logger, Style } from '@extraterm/extraterm-extension-api';
import { AlignmentFlag, Direction, FocusReason, QLineEdit, QWidget, TextFormat } from '@nodegui/nodegui';
import { BoxLayout, GridLayout, Label, LineEdit, PushButton, Widget } from 'qt-construct';
import { EventEmitter } from "extraterm-event-emitter";


export class FindControls {
  #log: Logger;
  #rootWidget: QWidget = null;
  #style: Style;
  #lineEdit: QLineEdit = null;

  #onCloseRequestEventEmitter = new EventEmitter<void>();
  onCloseRequest: Event<void> = null;

  #onSearchTextChangedEventEmitter = new EventEmitter<string>();
  onSearchTextChanged: Event<string> = null;

  constructor(style: Style, log: Logger) {
    this.#log = log;
    this.#style = style;
    this.onCloseRequest = this.#onCloseRequestEventEmitter.event;
    this.onSearchTextChanged = this.#onSearchTextChangedEventEmitter.event;

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
              }
            }),
            stretch: 1
          },
          {
            widget: PushButton({
              cssClass: ["small", "danger"],
              icon: this.#style.createQIcon("fa-times", this.#style.palette.textHighlight),
              onClicked: () => {
                this.#handleClone();
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

  #handleClone(): void {
    this.#onCloseRequestEventEmitter.fire();
  }

  #searchTextChanged(text: string): void {
    this.#onSearchTextChangedEventEmitter.fire(text);
  }
}
