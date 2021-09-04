/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QScrollArea, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, PushButton, ScrollArea, Widget } from "qt-construct";
import { EventEmitter, Event } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { ExtensionMetadata } from "../extension/ExtensionMetadata";
import { ExtensionManager } from "../InternalTypes";
import { createHtmlIcon } from "../ui/Icons";
import { UiStyle } from "../ui/UiStyle";


export class ExtensionsPage {
  private _log: Logger = null;
  #extensionManager: ExtensionManager = null;
  #uiStyle: UiStyle = null;
  #detailCards: ExtensionDetailCard[] = null;

  constructor(extensionManager: ExtensionManager, uiStyle: UiStyle) {
    this._log = getLogger("ExtensionsPage", this);
    this.#extensionManager = extensionManager;
    this.#uiStyle = uiStyle;
  }

  getPage(): QScrollArea {
    return ScrollArea({
      cssClass: "settings-tab",
      widget: Widget({
        cssClass: "settings-tab",
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-puzzle-piece")}&nbsp;&nbsp;Extensions`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]}),
            ...this.#createCards()
          ]
        })
      })
    });
  }

  #createCards(): QWidget[] {
    const detailCards: ExtensionDetailCard[] = [];
    for (const emd of this.#extensionManager.getAllExtensions()) {
      const card = new ExtensionDetailCard(this.#uiStyle, emd);
      card.onDetailsClick((name: string): void => this.#handleDetailsClick(name));
      detailCards.push(card);
    }
    this.#detailCards = detailCards;

    return this.#detailCards.map(card => card.getCardWidget());
  }

  #handleDetailsClick(cardName: string): void {
this._log.debug(`details clicked ${cardName}`);
  }
}

class ExtensionDetailCard {
  #extensionMetadata: ExtensionMetadata = null;
  #uiStyle: UiStyle = null;
  #cardWidget: QWidget = null;
  #onDetailsClickEventEmitter = new EventEmitter<string>();
  onDetailsClick: Event<string> = null;

  constructor(uiStyle: UiStyle, extensionMetadata: ExtensionMetadata) {
    this.#extensionMetadata = extensionMetadata;
    this.#uiStyle = uiStyle;
    this.onDetailsClick = this.#onDetailsClickEventEmitter.event;
    this.#createWidget();
  }

  getName(): string {
    return this.#extensionMetadata.name;
  }

  #createWidget(): void {
    this.#cardWidget = Widget({
      cssClass: ["extension-page-card"],
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          Label({
            cssClass: ["h3"],
            text: `${this.#extensionMetadata.displayName || this.#extensionMetadata.name} ${this.#extensionMetadata.version}`,
          }),
          Label({
            text: this.#extensionMetadata.description,
            wordWrap: true
          }),

          BoxLayout({
            contentsMargins: [0, 0, 0, 0],
            direction: Direction.LeftToRight,
            children: [
              {
                widget:
                  PushButton({
                    text: "Details",
                    cssClass: ["small"],
                    onClicked: () => this.#onDetailsClickEventEmitter.fire(this.#extensionMetadata.name),
                  }),
                stretch: 0,
              },
              {
                widget: Widget({}),
                stretch: 1,
              },
              {
                widget:
                  PushButton({
                    text: "Disable",
                    icon: this.#uiStyle.getButtonIcon("fa-pause"),
                    cssClass: ["small"]
                  }),
                stretch: 0,
                alignment: AlignmentFlag.AlignRight
              },
            ]
          })
        ]
      })
    });
  }

  getCardWidget(): QWidget {
    return this.#cardWidget;
  }

  // getDetailWidget(): QWidget {

  // }
}
