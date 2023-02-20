/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Style, Terminal, TerminalBorderWidget } from '@extraterm/extraterm-extension-api';
import { BoxLayout, Label, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { AlignmentFlag, Direction, QLabel, QWidget, TextFormat } from '@nodegui/nodegui';
import { Config } from './Config';


export class Banner {
  #config: Config = null;
  #terminalBannerWidget: TerminalBorderWidget = null;
  #bannerWidget: QWidget = null;
  #bannerLabel: QLabel = null;
  #style: Style = null;

  #onDismissClickedEventEmitter = new EventEmitter<void>();
  onDismissClicked: Event<void>;

  #onViewClickedEventEmitter = new EventEmitter<void>();
  onViewClicked: Event<void>;

  constructor(activeTerminal: Terminal, config: Config) {
    this.onDismissClicked = this.#onDismissClickedEventEmitter.event;
    this.onViewClicked = this.#onViewClickedEventEmitter.event;

    this.#config = config;
    this.#terminalBannerWidget = activeTerminal.createTerminalBorderWidget("new-update");
    this.#style = activeTerminal.tab.window.style;
    this.#bannerWidget = Widget({
      cssClass: ["background"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children:[
          {
            widget: this.#bannerLabel = Label({
              text: "",
              alignment: AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft,
              textFormat: TextFormat.RichText,
              wordWrap: true,
              openExternalLinks: true
            }),
            stretch: 1
          },
          PushButton({
            cssClass: ["success", "small"],
            text: "View",
            onClicked: () => {
              this.#onViewClickedEventEmitter.fire();
            }
          }),
          PushButton({
            cssClass: ["small"],
            text: "Dismiss",
            onClicked: () => {
              this.#onDismissClickedEventEmitter.fire();
            }
          })
        ]
      })
    });
    this.#terminalBannerWidget.contentWidget = this.#bannerWidget;
  }

  open(): void {
    this.updateConfig();
    this.#terminalBannerWidget.open();
  }

  close(): void {
    this.#terminalBannerWidget.close();
  }

  updateConfig(): void {
    this.#updateMessage();
  }

  #updateMessage(): void {
    this.#bannerLabel.setText(`${this.#style.htmlStyleTag}
<h3>${this.#style.createHtmlIcon("fa-gift")} A new Extraterm release is available: ${this.#config.newVersion}</h3>`);
  }
}
