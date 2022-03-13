/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { SessionConfiguration } from "@extraterm/extraterm-extension-api";
import { Direction, QBoxLayout, QFrame, QLabel, QPushButton, QScrollArea, QSizePolicyPolicy, QStackedWidget, QWidget,
  TextFormat
} from "@nodegui/nodegui";
import * as _ from 'lodash';
import { BoxLayout, Frame, Label, PushButton, ScrollArea, StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { UiStyle } from "../ui/UiStyle";
import { createHtmlIcon } from "../ui/Icons";
import { HoverPushButton, makeSubTabBar } from "../ui/QtConstructExtra";
import { ExtensionManager, SessionConfigurationChange, SessionSettingsChange } from "../InternalTypes";
import { createUuid } from "extraterm-uuid";


export class SessionTypesPage {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;

  #extensionManager: ExtensionManager = null;
  #uiStyle: UiStyle = null;

  #sessionsLayout: QBoxLayout = null;
  #page: QScrollArea = null;

  #cardStack: {id: number, card: SessionTypeCard}[] = [];
  #cardIdCounter = 0;

  #sessionConfig: SessionConfiguration[] = null;

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager,
      uiStyle: UiStyle) {

    this._log = getLogger("SessionTypesPage", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#uiStyle = uiStyle;

    this.#sessionConfig = this.#configDatabase.getSessionConfigCopy();
  }

  getPage(): QScrollArea {
    this.#page = ScrollArea({
      cssClass: "settings-tab",
      widgetResizable: true,

      widget: Widget({
        cssClass: "settings-tab",
        sizePolicy: {
          horizontal: QSizePolicyPolicy.MinimumExpanding,
          vertical: QSizePolicyPolicy.MinimumExpanding,
        },
        maximumWidth: 600,
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-terminal")}&nbsp;&nbsp;Session Types`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]
            }),
            Widget({
              sizePolicy: {
                horizontal: QSizePolicyPolicy.MinimumExpanding,
                vertical: QSizePolicyPolicy.Fixed,
              },
              layout: this.#sessionsLayout = BoxLayout({
                direction: Direction.TopToBottom,
                contentsMargins: [0, 0, 0, 0],
                children: []
              })
            }),

            BoxLayout({
              direction: Direction.LeftToRight,
              children: this.#createNewSessionTypeButtons()
            }),

            {stretch: 1, widget: Widget({}) }
          ]}
        )
      })
    });

    let i = 0;
    for (const sc of this.#sessionConfig) {
      this.#createSessionTypeConfigCard(sc, i === 0);
      i++;
    }

    return this.#page;
  }

  #createSessionTypeConfigCard(sessionConfig: SessionConfiguration, isDefault: boolean): void {
    const id = this.#cardIdCounter++;

    const card = new SessionTypeCard({
      uiStyle: this.#uiStyle,
      extensionManager: this.#extensionManager,
      sessionConfig,
      onConfigChanged: (sessionConfig: SessionConfiguration) => {
        const index = this.#cardIdToIndex(id);
        this.#sessionConfig[index] = sessionConfig;
        this.#configDatabase.setSessionConfig(this.#sessionConfig);
      },
      onMoveUpClicked: () => {
        this.#moveCardUp(id);
      },
      onDeleteClicked: () => {
        this.#deleteCard(id);
      },
      isDefault
    });
    this.#cardStack.push({id, card});

    this.#page.setUpdatesEnabled(false);
    this.#sessionsLayout.addWidget(card.getWidget());
    this.#page.update();
    this.#page.setUpdatesEnabled(true);
  }

  #moveCardUp(cardId: number): void {
    const index = this.#cardIdToIndex(cardId);
    const card = this.#cardStack[index];
    const config = this.#sessionConfig[index];

    this.#cardStack[0].card.setDefault(false);
    card.card.setDefault(true);

    this.#cardStack.splice(index, 1);
    this.#sessionConfig.splice(index, 1);

    this.#cardStack = [card, ...this.#cardStack];
    this.#sessionConfig = [config, ...this.#sessionConfig];

    this.#sessionsLayout.insertWidget(0, card.card.getWidget());

    this.#configDatabase.setSessionConfig(this.#sessionConfig);
  }

  #deleteCard(cardId: number): void {
    const index = this.#cardIdToIndex(cardId);
    const card = this.#cardStack[index];
    this.#cardStack.splice(index, 1);
    this.#sessionConfig.splice(index, 1);
    card.card.getWidget().setParent(null);
    this.#cardStack[0].card.setDefault(true);
    this.#configDatabase.setSessionConfig(this.#sessionConfig);
  }

  #createNewSessionTypeButtons(): QPushButton[] {
    return this.#extensionManager.getAllSessionTypes().map(st =>
      PushButton({
        text: `New ${st.name} session type`,
        onClicked: () => {
          const newSession: SessionConfiguration = {
            uuid: createUuid(),
            name: "new " + st.type,
            type: st.type,
            extensions: {}
          };

          this.#sessionConfig.push(newSession);
          this.#configDatabase.setSessionConfig(this.#sessionConfig);
          this.#createSessionTypeConfigCard(newSession, false);
        }
      }));
  }

  #cardIdToIndex(id: number): number {
    let i = 0;
    for (const cardPair of this.#cardStack) {
      if (cardPair.id === id) {
        return i;
      }
      i++;
    }
    return -1;
  }
}

interface SessionTypeCardOptions {
  uiStyle: UiStyle;
  extensionManager: ExtensionManager;
  sessionConfig: SessionConfiguration;
  onConfigChanged: (sessionConfig: SessionConfiguration) => void;
  onMoveUpClicked: () => void;
  onDeleteClicked: () => void;
  isDefault: boolean;
}


class SessionTypeCard {
  private _log: Logger = null;
  #widget: QFrame = null;
  #extensionManager: ExtensionManager = null;
  #sessionConfig: SessionConfiguration = null;
  #extensionsConfig: Object = null;
  #controlsStackedWidget: QStackedWidget = null;
  #isDefault = false;
  #onConfigChanged: (sessionConfig: SessionConfiguration) => void = null;

  constructor(options: SessionTypeCardOptions) {
    this._log = getLogger("SessionTypeCard", this);
    this.#extensionManager = options.extensionManager;
    this.#sessionConfig = _.cloneDeep(options.sessionConfig);
    this.#extensionsConfig = options.sessionConfig.extensions ?? {};
    this.#isDefault = options.isDefault;
    this.#onConfigChanged = options.onConfigChanged;

    let nameLabel: QLabel = null;

    const editor = this.#extensionManager.createSessionEditor(this.#sessionConfig.type, this.#sessionConfig);
    editor.onSessionConfigurationChanged((ev: SessionConfigurationChange) => {
      this.#sessionConfig = _.cloneDeep(ev.sessionConfiguration);
      this.#sessionConfig.extensions = this.#extensionsConfig;
      this.#onConfigChanged(this.#sessionConfig);
      nameLabel.setText(ev.sessionConfiguration.name);
    });

    this.#widget = Frame({
      cssClass: ["card"],
      sizePolicy: {
        horizontal: QSizePolicyPolicy.MinimumExpanding,
        vertical: QSizePolicyPolicy.Fixed,
      },
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children: [
          Widget({
            sizePolicy: {
              horizontal: QSizePolicyPolicy.MinimumExpanding,
              vertical: QSizePolicyPolicy.Fixed,
            },
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              children: [
                {
                  widget: nameLabel = Label({
                    cssClass: ["h3"],
                    text: options.sessionConfig.name,
                  }),
                  stretch: 1
                },
                {
                  widget: this.#controlsStackedWidget = StackedWidget({
                    currentIndex: this.#isDefault ? 0 : 1,
                    children: [
                      Label({text: "<i>Default</i>", textFormat: TextFormat.RichText}),
                      Widget({
                        layout: BoxLayout({
                          direction: Direction.LeftToRight,
                          contentsMargins: [0, 0, 0, 0],
                          children: [
                            HoverPushButton({
                              cssClass: ["microtool", "primary"],
                              iconPair: options.uiStyle.getBorderlessButtonIconPair("fa-angle-double-up"),
                              toolTip: "Make default",
                              onClicked: options.onMoveUpClicked
                            }),
                            HoverPushButton({
                              cssClass: ["microtool", "danger"],
                              iconPair: options.uiStyle.getBorderlessButtonIconPair("fa-times"),
                              onClicked: options.onDeleteClicked,
                              toolTip: "Delete"
                            }),
                          ]
                        })
                      })
                    ]
                  }),
                  stretch: 0
                }
              ]
            })
          }),

          Label({text: this.#getTypeName()}),
          editor._getWidget(),
          ...this.#getExtraSettings()
        ]
      })
    });
  }

  #getTypeName(): string {
    if (this.#extensionManager == null) {
      return "";
    }

    for (const sessionType of this.#extensionManager.getAllSessionTypes()) {
      if (sessionType.type === this.#sessionConfig.type) {
        return sessionType.name;
      }
    }
    return "";
  }

  setDefault(isDefault: boolean): void {
    this.#isDefault = isDefault;
    this.#controlsStackedWidget.setCurrentIndex(this.#isDefault ? 0 : 1);
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  #getExtraSettings(): QWidget[] {
    const settingEditors = this.#extensionManager.createSessionSettingsEditors(this.#sessionConfig.type,
      this.#sessionConfig);
    if (settingEditors.length === 0) {
      return [];
    }

    for (const se of settingEditors) {
      se.onSettingsChanged((change: SessionSettingsChange) => {
        this.#extensionsConfig[change.settingsConfigKey] = _.cloneDeep(change.settings);
        this.#sessionConfig.extensions = this.#extensionsConfig;
        this.#onConfigChanged(this.#sessionConfig);
      });
    }

    const editorStack = StackedWidget({
      children: settingEditors.map(se => se._getWidget())
    });

    const tabBar = makeSubTabBar({
      tabs: settingEditors.map(se => se.name),
      onCurrentChanged: (index: number): void => {
        editorStack.setCurrentIndex(index);
      },
    });

    return [tabBar, editorStack];
  }
}