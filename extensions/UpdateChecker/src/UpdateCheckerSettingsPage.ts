/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  Logger,
  SettingsTab
} from "@extraterm/extraterm-extension-api";
import { BoxLayout, CheckBox, ComboBox, Label, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { AlignmentFlag, Direction, QLabel, QPushButton, QWidget, SizeAdjustPolicy, TextFormat } from "@nodegui/nodegui";

import { Config } from "./Config.js";

const WEBSITE_ROOT = "https://extraterm.org/";


export class UpdateCheckerSettingsPage {
  #log: Logger = null;

  #onConfigChangedEventEmitter = new EventEmitter<Config>();
  onConfigChanged: Event<Config> = null;

  #onCheckNowEventEmitter = new EventEmitter<void>();
  onCheckNow: Event<void> = null;

  #checkNowButton: QPushButton = null;

  #config: Config = null;
  #extensionTab: SettingsTab = null;
  #message: QLabel = null;

  constructor(extensionTab: SettingsTab, config: Config, log: Logger) {
    this.#log = log;
    this.#extensionTab = extensionTab;
    this.#config = config;
    this.onConfigChanged = this.#onConfigChangedEventEmitter.event;
    this.onCheckNow = this.#onCheckNowEventEmitter.event;

    extensionTab.contentWidget = this.#createUI();
    this.#updateMessage();
  }

  configChanged(): void {
    this.#updateMessage();
  }

  #createUI(): QWidget {
    return Widget({
      maximumWidth: 800,
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children:[
          this.#message = Label({
            text: "",
            alignment: AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft,
            textFormat: TextFormat.RichText,
            wordWrap: true,
            openExternalLinks: true
          }),
          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              spacing: 0,
              contentsMargins: [0, 0, 0, 0],
              children: [
                CheckBox({
                  text: "Regularly check for updates",
                  checkable: true,
                  checked: this.#config.checkOn,
                  onClicked: (checked) => {
                    this.#config.checkOn = checked;
                    this.#onConfigChangedEventEmitter.fire(this.#config);
                  },
                }),
                {
                  widget: Widget({}),
                  stretch: 1,
                }
              ]
            })
          }),
          this.#checkNowButton = PushButton({
            text: "Check now",
            onClicked: () => {
              this.#onCheckNowEventEmitter.fire();
            }
          })
        ]
      })
    });
  }

  #updateMessage(): void {
    let msg = "";
    const newVersion = this.#config.newVersion;
    const style = this.#extensionTab.style;
    if (newVersion == null) {
      msg = `${style.htmlStyleTag}<h3>All up to date</h3>
      <hr>`;
    } else {
      const url = WEBSITE_ROOT + this.#config.newUrl;
      const externalLinkIcon = style.createHtmlIcon("fa-external-link-alt");
      msg = `${style.htmlStyleTag}<h2>Version ${newVersion} is available!</h2>
      <p>Read more here: <a href="${url}">${url} ${externalLinkIcon}</a></p>
      <hr>`;
    }
    this.#message.setText(msg);
  }

  setIsFetchingReleaseJSON(isFetchingReleaseJSON: boolean): void {
    this.#checkNowButton.setEnabled( ! isFetchingReleaseJSON);
  }
}
