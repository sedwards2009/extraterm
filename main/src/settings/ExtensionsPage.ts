/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QBoxLayout, QIcon, QLabel, QPushButton, QScrollArea, QSizePolicyPolicy, QStackedWidget, QWidget, TextFormat, TextInteractionFlag } from "@nodegui/nodegui";
import { BoxLayout, Label, PushButton, ScrollArea, StackedWidget, TabWidget, Widget } from "qt-construct";
import { EventEmitter, Event } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { ExtensionMetadata } from "../extension/ExtensionMetadata";
import { ExtensionManager } from "../InternalTypes";
import { createHtmlIcon } from "../ui/Icons";
import { UiStyle } from "../ui/UiStyle";
import { makeLinkLabel, makeSubTabBar } from "../ui/QtConstructExtra";

enum SubPage {
  ALL_EXTENSIONS = 0,
  EXTENSION_DETAILS = 1
}

interface MenuPair {
  context: string;
  command: string;
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
          widgetResizable: true,
          widget: Widget({
            cssClass: "settings-tab",
            sizePolicy: {
              horizontal: QSizePolicyPolicy.MinimumExpanding,
              vertical: QSizePolicyPolicy.Fixed,
            },
            maximumWidth: 600,
            layout: BoxLayout({
              direction: Direction.TopToBottom,
              children: [
                Label({
                  text: `${createHtmlIcon("fa-puzzle-piece")}&nbsp;&nbsp;Extensions`,
                  textFormat: TextFormat.RichText,
                  cssClass: ["h2"]}),
                // All Extensions Cards
                Widget({
                  sizePolicy: {
                    horizontal: QSizePolicyPolicy.MinimumExpanding,
                    vertical: QSizePolicyPolicy.Fixed,
                  },
                  maximumWidth: 600,
                  layout: BoxLayout({
                    direction: Direction.TopToBottom,
                    contentsMargins: [0, 0, 0, 0],
                    children: [
                      ...this.#createCards()
                    ]
                  })
                }),
                { widget: Widget({}), stretch: 1 }
              ]
            })
          })
        }),

        this.#detailsScrollArea = ScrollArea({
          cssClass: "settings-tab",
          widgetResizable: true,
          widget: Widget({
            cssClass: "settings-tab",
            sizePolicy: {
              horizontal: QSizePolicyPolicy.MinimumExpanding,
              vertical: QSizePolicyPolicy.Fixed,
            },
            maximumWidth: 600,
            layout: this.#detailsPageLayout = BoxLayout({
              direction: Direction.TopToBottom,
              children: [
                Label({
                  text: `${createHtmlIcon("fa-puzzle-piece")}&nbsp;&nbsp;Extensions`,
                  textFormat: TextFormat.RichText,
                  cssClass: ["h2"]}),

                // Extension Details
                Widget({
                  sizePolicy: {
                    horizontal: QSizePolicyPolicy.MinimumExpanding,
                    vertical: QSizePolicyPolicy.Fixed,
                  },
                  layout: this.#detailsContentsLayout = BoxLayout({
                    direction: Direction.TopToBottom,
                    contentsMargins: [0, 0, 0, 0],
                    children: [
                      makeLinkLabel({
                        text: `<a href="_">${createHtmlIcon("fa-arrow-left")}&nbsp;All Extensions</a>`,
                        uiStyle: this.#uiStyle,
                        onLinkActivated: (url: string): void => this.#handleBackLink()
                      }),
                      this.#detailsStack = StackedWidget({
                        sizePolicy: {
                          horizontal: QSizePolicyPolicy.MinimumExpanding,
                          vertical: QSizePolicyPolicy.Fixed,
                        },
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
      if (emd.isInternal) {
        continue;
      }
      const card = new ExtensionDetailCard(this.#extensionManager, this.#uiStyle, emd);
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
  #extensionManager: ExtensionManager = null;
  #extensionMetadata: ExtensionMetadata = null;
  #uiStyle: UiStyle = null;
  #cardWidget: QWidget = null;
  #detailsWidget: QWidget = null;
  #onDetailsClickEventEmitter = new EventEmitter<string>();
  onDetailsClick: Event<string> = null;

  constructor(extensionManager: ExtensionManager, uiStyle: UiStyle, extensionMetadata: ExtensionMetadata) {
    this.#extensionManager = extensionManager;
    this.#extensionMetadata = extensionMetadata;
    this.#uiStyle = uiStyle;
    this.onDetailsClick = this.#onDetailsClickEventEmitter.event;
  }

  getName(): string {
    return this.#extensionMetadata.name;
  }

  #createWidget(showDetailsButton: boolean): QWidget {
    let trafficLight: QLabel;
    let enableDisableButton: QPushButton;

    const result = Widget({
      cssClass: ["extension-page-card"],
      sizePolicy: {
        horizontal: QSizePolicyPolicy.MinimumExpanding,
        vertical: QSizePolicyPolicy.Fixed,
      },
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
                  trafficLight = Label({
                    text: "",
                    textFormat: TextFormat.RichText,
                  })
              },
              {
                widget:
                  enableDisableButton = PushButton({
                    text: "",
                    cssClass: ["small"],
                    onClicked: () => {
                      if (this.#extensionManager.isExtensionEnabled(this.#extensionMetadata.name)) {
                        this.#extensionManager.disableExtension(this.#extensionMetadata.name);
                      } else {
                        this.#extensionManager.enableExtension(this.#extensionMetadata.name);
                      }
                    },
                  }),
                stretch: 0,
                alignment: AlignmentFlag.AlignRight
              },
            ]
          })
        ]
      })
    });

    const updateTrafficLight = () => {
      let color: string;
      let icon: QIcon;
      let text: string;
      if (this.#extensionManager.isExtensionEnabled(this.#extensionMetadata.name)) {
        color = this.#uiStyle.getTrafficLightRunningColor();
        text = "Disable";
        icon = this.#uiStyle.getButtonIcon("fa-pause");
      } else {
        color  = this.#uiStyle.getTrafficLightStoppedColor();
        text = "Enable";
        icon = this.#uiStyle.getButtonIcon("fa-play");
      }
      trafficLight.setText(`<font color="${color}">${createHtmlIcon("fa-circle")}</font>`);
      enableDisableButton.setIcon(icon);
      enableDisableButton.setText(text);
    };
    this.#extensionManager.onDesiredStateChanged(updateTrafficLight);
    updateTrafficLight();

    return result;
  }

  getCardWidget(): QWidget {
    this.#cardWidget = this.#createWidget(true);
    return this.#cardWidget;
  }

  getDetailsWidget(): QWidget {
    let detailsStack: QStackedWidget;

    this.#detailsWidget = Widget({
      maximumWidth: 600,
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

          makeSubTabBar({
            tabs: ["Details", "Feature Contributions"],
            onCurrentChanged: (index: number): void => {
              detailsStack.setCurrentIndex(index);
            },
          }),

          detailsStack = StackedWidget({
            children: [
              Label({
                text: this.#extensionMetadata.description,
                textFormat: TextFormat.RichText,
                wordWrap: true,
                alignment: AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft,
                textInteractionFlag: TextInteractionFlag.TextSelectableByMouse,
                sizePolicy: {
                  horizontal: QSizePolicyPolicy.MinimumExpanding,
                  vertical: QSizePolicyPolicy.Fixed,
                },
              }),

              Label({
                text: this.#getContributionsHTML(),
                textFormat: TextFormat.RichText,
                wordWrap: true,
                alignment: AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft,
                textInteractionFlag: TextInteractionFlag.TextSelectableByMouse,
                sizePolicy: {
                  horizontal: QSizePolicyPolicy.MinimumExpanding,
                  vertical: QSizePolicyPolicy.Fixed,
                },
              })
            ]
          }),

          {
            widget: Widget({}),
            stretch: 1
          },
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
        <table width="100%">
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
        </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.keybindings.length !== 0) {
      parts.push(`
        <h4>Keybindings</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const keybindings of contributes.keybindings) {
        parts.push(`
          <tr>
            <td>${keybindings.path}</td>
          </tr>
          `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    const menus = this.#getMenus();
    if (menus.length !== 0) {
      parts.push(`
        <h4>Menus</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Context</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const menuPair of menus) {
        parts.push(`
          <tr>
            <td>${menuPair.context}</td>
            <td>${menuPair.command}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.sessionBackends.length !== 0) {
      parts.push(`
        <h4>Session backends</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const backend of contributes.sessionBackends) {
        parts.push(`
          <tr>
            <td>${backend.name}</td>
            <td>${backend.type}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.sessionEditors.length !== 0) {
      parts.push(`
        <h4>Session editors</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const sessionEditor of contributes.sessionEditors) {
        parts.push(`
          <tr>
            <td>${sessionEditor.name}</td>
            <td>${sessionEditor.type}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.sessionSettings.length !== 0) {
      parts.push(`
        <h4>Session settings</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const sessionSettings of contributes.sessionSettings) {
        parts.push(`
          <tr>
            <td>${sessionSettings.name}</td>
            <td>${sessionSettings.id}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.tabTitleWidgets.length !== 0) {
      parts.push(`
        <h4>Tab title widgets</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const tabTitleWidget of contributes.tabTitleWidgets) {
        parts.push(`
          <tr>
            <td>${tabTitleWidget.name}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.terminalBorderWidgets.length !== 0) {
      parts.push(`
        <h4>Terminal border widgets</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Border</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const terminalBorderWidget of contributes.terminalBorderWidgets) {
        parts.push(`
          <tr>
            <td>${terminalBorderWidget.name}</td>
            <td>${terminalBorderWidget.border}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.terminalThemeProviders.length !== 0) {
      parts.push(`
        <h4>Terminal themes</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Formats</th>
            </tr>
          </thead>
          <tbody>
        `);
      for (const terminalThemeProvider of contributes.terminalThemeProviders) {
        parts.push(`
          <tr>
            <td>${terminalThemeProvider.name}</td>
            <td>${terminalThemeProvider.humanFormatNames.join(", ")}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    if (contributes.viewers.length !== 0) {
      parts.push(`
        <h4>Viewers</h4>
        <table width="100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mime-types</th>
            </tr>
          </thead>
          <tbody>
      `);
      for (const viewer of contributes.viewers) {
        parts.push(`
          <tr>
            <td>${viewer.name}</td>
            <td>${viewer.mimeTypes.join(", ")}</td>
          </tr>
        `);
      }
      parts.push(`
          </tbody>
        </table>
      `);
    }

    return parts.join("");
  }

  #getMenus(): MenuPair[] {
    const menus = this.#extensionMetadata.contributes.menus;
    return [
      ...menus.commandPalette.map(m => ({ context: "Command palette", command: m.command })),
      ...menus.contextMenu.map(m => ({ context: "Context menu", command: m.command })),
      ...menus.newTerminal.map(m => ({ context: "New terminal", command: m.command })),
      ...menus.terminalTab.map(m => ({ context: "Terminal tab", command: m.command })),
    ];
  }
}
