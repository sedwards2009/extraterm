/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { getLogger, Logger } from "extraterm-logging";
import {
  Direction, QBoxLayout, QLabel, QScrollArea, QSizePolicyPolicy, QStackedWidget, QWidget, TextFormat
} from "@nodegui/nodegui";
import {
  BoxLayout, ComboBox, Frame, GridLayout, Label, LineEdit, PushButton, ScrollArea, SpinBox, StackedWidget, Widget
} from "qt-construct";

import { createHtmlIcon } from "../ui/Icons.js";
import { UiStyle } from "../ui/UiStyle.js";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { HoverPushButton, makeGroupLayout, shrinkWrap } from "../ui/QtConstructExtra.js";
import { CommandLineAction, CommandLineActionMatchType, FrameRule } from "../config/Config.js";
import { SettingsPageType } from "./SettingsPageType.js";


const frameActionOptions: {id: FrameRule, name: string}[] = [
  { id: "always_frame", name: "Always frame command output" },
  { id: "never_frame", name: "Never frame command output" },
  { id: "frame_if_lines", name: "Frame command output if longer than" },
];

export class FramesPage implements SettingsPageType {
  private _log: Logger = null;

  #uiStyle: UiStyle = null;
  #configDatabase: ConfigDatabase = null;
  #rulesLayout: QBoxLayout = null;
  #page: QScrollArea = null;

  #cardStack: {id: number, card: FrameRuleConfigCard}[] = [];
  #cardIdCounter = 0;

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle) {
    this._log = getLogger("FramesPage", this);
    this.#configDatabase = configDatabase;
    this.#uiStyle = uiStyle;
  }

  getIconName(): string {
    return "fa-window-maximize";
  }

  getMenuText(): string {
    return "Frames";
  }

  getName(): string {
    return null;
  }

  getPage(): QScrollArea {
    const generalConfig = this.#configDatabase.getGeneralConfig();

    const defaultEditor = new FrameRuleConfigEditor({
      frameAction: generalConfig.frameRule,
      lines: generalConfig.frameRuleLines,
      onFrameActionChanged: (frameAction: FrameRule): void => {
        const generalConfigCopy = this.#configDatabase.getGeneralConfigCopy();
        generalConfigCopy.frameRule = frameAction;
        this.#configDatabase.setGeneralConfig(generalConfigCopy);
      },
      onLinesChanged: (lines: number): void => {
        const generalConfigCopy = this.#configDatabase.getGeneralConfigCopy();
        generalConfigCopy.frameRuleLines = lines;
        this.#configDatabase.setGeneralConfig(generalConfigCopy);
      }
    });

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
              text: `${createHtmlIcon("fa-window-maximize")}&nbsp;&nbsp;Frame Handling Rules`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]
            }),

            BoxLayout({
              direction: Direction.LeftToRight,
              children: [
                Label({
                  text: "Default action:",
                }),
                defaultEditor.getWidget()
              ]
            }),

            Widget({
              sizePolicy: {
                horizontal: QSizePolicyPolicy.MinimumExpanding,
                vertical: QSizePolicyPolicy.Fixed,
              },
              layout: this.#rulesLayout = BoxLayout({
                direction: Direction.TopToBottom,
                contentsMargins: [0, 0, 0, 0],
                children: []
              })
            }),

            shrinkWrap(PushButton({text: "New Rule", onClicked: () => this.#handleNewRuleClicked()})),
            Label({text: "Add rules to customize whether different commands are framed or not." }),

            {stretch: 1, widget: Widget({}) }
          ]
        })
      })
    });

    const commandLineActions = this.#configDatabase.getCommandLineActionConfigCopy();
    for (const cla of commandLineActions) {
      this.#createRuleCard(cla);
    }

    return this.#page;
  }

  #createRuleCard(cla: CommandLineAction): void {
    const id = this.#cardIdCounter++;

    const update = (func: (cla: CommandLineAction) => void): void => {
      const index = this.#cardIdToIndex(id);
      const commandLineActions = this.#configDatabase.getCommandLineActionConfigCopy();
      func(commandLineActions[index]);
      this.#configDatabase.setCommandLineActionConfig(commandLineActions);
    };

    const card = new FrameRuleConfigCard({
      uiStyle: this.#uiStyle,
      commandLineAction: cla,
      onDeleteClicked: () => {
        const index = this.#cardIdToIndex(id);
        const commandLineActions = this.#configDatabase.getCommandLineActionConfigCopy();
        commandLineActions.splice(index, 1);
        this.#cardStack.splice(index, 1);
        this.#configDatabase.setCommandLineActionConfig(commandLineActions);

        this.#page.setUpdatesEnabled(false);
        card.getWidget().setParent(null);
        this.#page.update();
        this.#page.setUpdatesEnabled(true);
      },
      onFrameActionChanged: (frameAction: FrameRule) => {
        update(cla => cla.frameRule = frameAction);
      },
      onLinesChanged: (lines: number) => {
        update(cla => cla.frameRuleLines = lines);
      },
      onMatchChanged: (match: string) => {
        update(cla => cla.match = match);
      },
      onMatchTypeChanged: (type: CommandLineActionMatchType) => {
        update(cla => cla.matchType = type);
      },
    });
    this.#cardStack.push({id, card});

    this.#page.setUpdatesEnabled(false);
    this.#rulesLayout.addWidget(card.getWidget());
    this.#page.update();
    this.#page.setUpdatesEnabled(true);
  }

  #handleNewRuleClicked(): void {
    const commandLineActions = this.#configDatabase.getCommandLineActionConfigCopy();
    const commandLineAction: CommandLineAction = {
      match: "",
      matchType: "name",
      frameRule: "always_frame",
      frameRuleLines: 1
    };
    commandLineActions.push(commandLineAction);
    this.#configDatabase.setCommandLineActionConfig(commandLineActions);
    this.#createRuleCard(commandLineAction);
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


interface FrameRuleConfigEditorOptions {
  frameAction: FrameRule;
  lines: number;
  onFrameActionChanged: (frameAction: FrameRule) => void;
  onLinesChanged: (lines: number) => void;
}


class FrameRuleConfigEditor {
  #widget: QWidget = null;
  #stackedWidget: QStackedWidget = null;

  constructor(options: FrameRuleConfigEditorOptions) {
    const onFrameActionChanged = options.onFrameActionChanged;
    this.#widget = Widget({
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: [0, 0, 0, 0],
        children: [
          ComboBox({
            items: frameActionOptions.map(fa => fa.name),
            currentIndex: frameActionOptions.map(fa => fa.id).indexOf(options.frameAction),
            onActivated: (index: number) => {
              const frameAction = frameActionOptions[index].id;
              this.#updateVisible(frameAction);
              onFrameActionChanged(frameAction);
            }
          }),
          this.#stackedWidget = StackedWidget({
            currentIndex: options.frameAction === "frame_if_lines" ? 1 : 0,
            children: [
              Label({text: ""}),
              Widget({
                layout: makeGroupLayout(
                    SpinBox({
                      minimum: 0,
                      maximum: 9999,
                      value: options.lines == null ? 5 : options.lines,
                      onValueChanged: options.onLinesChanged,
                    }),
                    Label({text: "lines"})
                )
              }),
            ]
          })
        ]
      })
    });

    this.#updateVisible(options.frameAction);
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  #updateVisible(frameAction: FrameRule): void {
    this.#stackedWidget.setCurrentIndex(frameAction === "frame_if_lines" ? 1 : 0);
  }
}


interface FrameRuleConfigCardOptions {
  uiStyle: UiStyle;
  commandLineAction: CommandLineAction,
  onMatchChanged: (text: string) => void;
  onMatchTypeChanged: (type: CommandLineActionMatchType) => void;
  onFrameActionChanged: (frameAction: FrameRule) => void;
  onLinesChanged: (lines: number) => void;
  onDeleteClicked: () => void;
}

class FrameRuleConfigCard {

  #widget: QWidget = null;

  constructor(options: FrameRuleConfigCardOptions) {

    const configEditor = new FrameRuleConfigEditor({
      frameAction: options.commandLineAction.frameRule,
      lines: options.commandLineAction.frameRuleLines,
      onFrameActionChanged: options.onFrameActionChanged,
      onLinesChanged: options.onLinesChanged
    });

    let titleLabel: QLabel = null;

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
                  widget: titleLabel = Label({
                    cssClass: ["h3"],
                    text: `Rule: ${options.commandLineAction.match}`,
                  }),
                  stretch: 1
                },
                {
                  widget: HoverPushButton({
                    cssClass: ["microtool", "danger"],
                    iconPair: options.uiStyle.getBorderlessButtonIconPair("fa-times"),
                    onClicked: options.onDeleteClicked
                  }),
                  stretch: 0
                }
              ]
            })
          }),

          Widget({
            sizePolicy: {
              horizontal: QSizePolicyPolicy.MinimumExpanding,
              vertical: QSizePolicyPolicy.Fixed,
            },
            layout: GridLayout({
              columns: 2,
              contentsMargins: [0, 0, 0, 0],
              children: [
                "Match:", {
                  widget: Widget({
                    layout: BoxLayout({
                      direction: Direction.LeftToRight,
                      contentsMargins: [0, 0, 0, 0],
                      children: [
                        LineEdit({
                          text: options.commandLineAction.match,
                          onTextEdited: (newText:string) => {
                            titleLabel.setText(`Rule: ${newText}`);
                            options.onMatchChanged(newText);
                          }
                        }),

                        ComboBox({
                          items: ["Match command name", "Match regular expression"],
                          currentIndex: options.commandLineAction.matchType === "name" ? 0 : 1,
                          onActivated: (index: number) => {
                            const matchTypes: CommandLineActionMatchType[] = ["name", "regexp"];
                            options.onMatchTypeChanged(matchTypes[index]);
                          }
                        })
                      ]
                    })
                  })
                },
                "Action:", configEditor.getWidget()
              ]
            })
          })

        ]
      })
    });
  }

  getWidget(): QWidget {
    return this.#widget;
  }
}
