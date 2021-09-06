/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QBoxLayout, QScrollArea, QStackedWidget, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, PushButton, ScrollArea, StackedWidget, Widget } from "qt-construct";
import { EventEmitter, Event } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { ExtensionMetadata } from "../extension/ExtensionMetadata";
import { ExtensionManager } from "../InternalTypes";
import { createHtmlIcon } from "../ui/Icons";
import { UiStyle } from "../ui/UiStyle";
import { makeLinkLabel } from "../ui/QtConstructExtra";

enum SubPage {
  ALL_EXTENSIONS = 0,
  EXTENSION_DETAILS = 1
}


export class ExtensionsPage {
  private _log: Logger = null;
  #extensionManager: ExtensionManager = null;
  #uiStyle: UiStyle = null;
  #detailCards: ExtensionDetailCard[] = null;
  #topLevelStack: QStackedWidget = null;
  #detailsStack: QStackedWidget = null;
  #detailsStackMapping = new Map<string, number>();
  #detailsPageLayout: QBoxLayout = null;

  #detailsContentsLayout: QBoxLayout = null;

  #detailsScrollArea: QScrollArea = null;

  constructor(extensionManager: ExtensionManager, uiStyle: UiStyle) {
    this._log = getLogger("ExtensionsPage", this);
    this.#extensionManager = extensionManager;
    this.#uiStyle = uiStyle;
  }

  getPage(): QWidget {
    this.#topLevelStack = StackedWidget({
      children: [
        ScrollArea({
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
                // All Extensions Cards
                Widget({
                  layout: BoxLayout({
                    direction: Direction.TopToBottom,
                    children: [
                      ...this.#createCards()
                    ]
                  })
                })
              ]
            })
          })
        }),

        this.#detailsScrollArea = ScrollArea({
          cssClass: "settings-tab",
          widget: Widget({
            cssClass: "settings-tab",
            layout: this.#detailsPageLayout = BoxLayout({
              direction: Direction.TopToBottom,
              children: [
                Label({
                  text: `${createHtmlIcon("fa-puzzle-piece")}&nbsp;&nbsp;Extensions`,
                  textFormat: TextFormat.RichText,
                  cssClass: ["h2"]}),

                // Extension Details
                Widget({
                  layout: this.#detailsContentsLayout = BoxLayout({
                    direction: Direction.TopToBottom,
                    children: [
                      makeLinkLabel({
                        text: `<a href="_">${createHtmlIcon("fa-arrow-left")}&nbsp;All Extensions</a>`,
                        uiStyle: this.#uiStyle,
                        onLinkActivated: (url: string): void => this.#handleBackLink()
                      }),
                      this.#detailsStack = StackedWidget({
                        children: [...this.#createAllDetailsPages()]
                      }),
                      { widget: Widget({}), stretch: 1 }
                    ]
                  })
                })
              ]
            })
          })
        })
      ]
    });
    return this.#topLevelStack;
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

  #createAllDetailsPages(): QWidget[] {
    for (const [i, card] of this.#detailCards.entries()) {
      this.#detailsStackMapping.set(card.getName(), i);
    }

    return this.#detailCards.map(card => card.getDetailsWidget());
  }

  #handleDetailsClick(cardName: string): void {
    this.#showDetailsPage(cardName);
  }

  #showDetailsPage(cardName: string): void {
    this.#topLevelStack.setCurrentIndex(SubPage.EXTENSION_DETAILS);

    if (! this.#detailsStackMapping.has(cardName)) {
      for (const card of this.#detailCards) {
        if (card.getName() === cardName) {
          const detailsWidget = card.getDetailsWidget();
          const count = this.#detailsStack.count();

// detailsWidget.setMinimumSize(200, 400);

          this.#detailsStack.addWidget(detailsWidget);

          this.#detailsStackMapping.set(cardName, count);
          this.#detailsStack.setCurrentIndex(count);

// this.#detailsStack.setMinimumSize(200, 400);

// this.#detailsStack.updateGeometry();

// detailsWidget.layout.update();
// this._log.debug(`detailsWidget.minimumSize.height: ${detailsWidget.minimumSize().height()}`);

// this.#detailsPageLayout.update();
// this.#detailsContentsLayout.update();

// const geo = this.#detailsStack.geometry();
// this._log.debug(`#detailsStack.geo.height: ${geo.height()}`);

// const minSize = this.#detailsStack.minimumSize();
// this._log.debug(`#detailsStack.minimumSize ${minSize.height()}`);
// this.#detailsStack.dumpObjectTree();
// this._log.debug(`detailsWidget.minimumSize() ${detailsWidget.minimumSize().height()}`);

// this.#detailsScrollArea.update();

// this._log.debug(`this.#detailsScrollArea.viewport().height(): ${this.#detailsScrollArea.viewport().height()}`);
// this.#detailsScrollArea.viewport().setMinimumSize(200, 400);
// this.#detailsScrollArea.viewport().update();

// this._log.debug(`this.#detailsScrollArea.height(): ${this.#detailsScrollArea.height()}`);

// this.#detailsScrollArea.geometry().height()

        }
      }
    } else {
      this.#detailsStack.setCurrentIndex(this.#detailsStackMapping.get(cardName));
    }
  }

  #handleBackLink(): void {
    this.#topLevelStack.setCurrentIndex(SubPage.ALL_EXTENSIONS);
  }
}

class ExtensionDetailCard {
  #extensionMetadata: ExtensionMetadata = null;
  #uiStyle: UiStyle = null;
  #cardWidget: QWidget = null;
  #detailsWidget: QWidget = null;
  #onDetailsClickEventEmitter = new EventEmitter<string>();
  onDetailsClick: Event<string> = null;

  constructor(uiStyle: UiStyle, extensionMetadata: ExtensionMetadata) {
    this.#extensionMetadata = extensionMetadata;
    this.#uiStyle = uiStyle;
    this.onDetailsClick = this.#onDetailsClickEventEmitter.event;
  }

  getName(): string {
    return this.#extensionMetadata.name;
  }

  #createWidget(showDetailsButton: boolean): QWidget {
    return Widget({
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
              showDetailsButton && {
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
    this.#cardWidget = this.#createWidget(true);
    return this.#cardWidget;
  }

  getDetailsWidget(): QWidget {
    this.#detailsWidget = Widget({
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [0, 0, 0, 0],
        children: [
          this.#createWidget(false),

          this.#extensionMetadata.homepage && makeLinkLabel({
            text: `${createHtmlIcon("fa-home")}&nbsp;Home page: <a href="${this.#extensionMetadata.homepage}">${this.#extensionMetadata.homepage}</a>`,
            uiStyle: this.#uiStyle,
            openExternalLinks: true,
            wordWrap: true
          }),

          Label({
            text: this.#getContributionsHTML(),
            textFormat: TextFormat.RichText,
          })
        ]
      })
    });

    return this.#detailsWidget;
  }

  #getContributionsHTML(): string {
    const parts: string[] =[];
    const contributes = this.#extensionMetadata.contributes;

    parts.push(this.#uiStyle.getHTMLStyle());
    if (contributes.commands.length !== 0) {
      parts.push(`
    <h4>Commands</h4>
    <table class="width-100pc cols-1-1">
      <thead>
        <tr>
          <th>Title</th>
          <th>Command</th>
        </tr>
      </thead>
      <tbody>
`);
      
      for(const command of contributes.commands) {
        parts.push(`
        <tr>
          <td>${command.title}</td>
          <td>${command.command}</td>
        </tr>`);
      }
      parts.push(`
      </tbody>
    </table>
`);
    }
    return parts.join("");
  }
}
