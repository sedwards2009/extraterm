/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QLabel, QLineEdit, QScrollArea, QSizePolicyPolicy, QStackedWidget, QWidget,
  TextFormat } from "@nodegui/nodegui";
import { BoxLayout, ComboBox, GridLayout, GridLayoutChild, Label, LineEdit, PushButton, ScrollArea, StackedWidget,
  Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { UiStyle } from "../../ui/UiStyle.js";
import { createHtmlIcon } from "../../ui/Icons.js";
import { HoverPushButton, shrinkWrap } from "../../ui/QtConstructExtra.js";
import { ConfigDatabase } from "../../config/ConfigDatabase.js";
import { GeneralConfig } from "../../config/Config.js";
import { CustomKeybindingsSet, LogicalKeybindingsName } from "../../keybindings/KeybindingsTypes.js";
import { ExtensionManager } from "../../InternalTypes.js";
import { Category, ExtensionCommandContribution } from "../../extension/ExtensionMetadata.js";
import { KeybindingsIOManager } from "../../keybindings/KeybindingsIOManager.js";
import { CommandBindingEditor } from "./CommandBindingEditor.js";
import { CommandKeybindingInfo } from "./CommandKeybindingInfo.js";
import { KeyRecord } from "./KeyRecord.js";
import { SettingsPageType } from "../SettingsPageType.js";


interface KeybindingStyle {
  id: LogicalKeybindingsName;
  name: string;
}

const keybindingStyles: KeybindingStyle[] = [
  {
    id: "pc-style",
    name: "PC style"
  },
  {
    id: "macos-style",
    name: "MacOS style",
  },
];

const categoryNames = {
  "global": "Global",
  "application": "Application",
  "window": "Window",
  "textEditing": "Text Editor",
  "terminal": "Terminal",
  "terminalCursorMode": "Terminal: Cursor Mode",
  "hyperlink": "Hyperlink",
  "viewer": "Viewer Tabs"
};

interface CategoryInfo {
  category: Category;
  title: string;
  commandLabel?: QLabel;
  countPillLabel?: QLabel;
  keyLabel?: QLabel;
  commandBindingEditorList: CommandBindingEditor[];
}


const PAGE_WIDTH_PX = 600;


export class KeybindingsPage implements SettingsPageType {
  private _log: Logger = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: ExtensionManager = null;
  #commandBindingEditorMap = new Map<string, CommandBindingEditor>();
  #keybindingsIOManager: KeybindingsIOManager = null;
  #uiStyle: UiStyle = null;
  #keybindingsName: LogicalKeybindingsName = null;
  #page: QScrollArea = null;

  #commandKeybindingsMapping: Map<string, CommandKeybindingInfo> = null;
  #recordLineEdit: KeyRecord = null;
  #isSuppressWrites = false;

  #categoryInfoList: CategoryInfo[] = [];

  constructor(configDatabase: ConfigDatabase, extensionManager: ExtensionManager,
      keybindingsIOManager: KeybindingsIOManager, uiStyle: UiStyle) {

    this._log = getLogger("KeybindingsPage", this);
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;
  }

  getIconName(): string {
    return "fa-keyboard";
  }

  getMenuText(): string {
    return "Keybindings";
  }

  getName(): string {
    return null;
  }

  getPage(): QScrollArea {
    if (this.#page == null) {
      this.#page = this.#createPage();
    }
    return this.#page;
  }

  #createPage(): QScrollArea {
    const config = this.#configDatabase.getGeneralConfig();
    const currentStyleIndex = keybindingStyles.map(ks => ks.id).indexOf(config.keybindingsName);
    this.#keybindingsName = config.keybindingsName;

    this.#commandKeybindingsMapping = this.#createCommandKeybindingInfo(config.keybindingsName);
    this.#updateKeybindingInfos(config.keybindingsName, this.#commandKeybindingsMapping);

    const update = (mutator: (config: GeneralConfig) => void): void => {
      const generalConfig = this.#configDatabase.getGeneralConfigCopy();
      mutator(generalConfig);
      this.#configDatabase.setGeneralConfig(generalConfig);
    };

    let stackedWidget: QStackedWidget = null;
    let filterLineEdit: QLineEdit = null;

    this.#recordLineEdit = new KeyRecord();
    this.#recordLineEdit.onRecordCancelled(() => {
      stackedWidget.setCurrentIndex(0);
    });
    this.#recordLineEdit.onKeyPress((keyCode: string): void => {
      filterLineEdit.setText(keyCode);
      this.#setSearchText(keyCode);
      stackedWidget.setCurrentIndex(0);
    });

    return ScrollArea({
      cssClass: "settings-tab",
      widgetResizable: true,
      widget: Widget({
        cssClass: "settings-tab",
        sizePolicy: {
          horizontal: QSizePolicyPolicy.MinimumExpanding,
          vertical: QSizePolicyPolicy.MinimumExpanding,
        },
        maximumWidth: PAGE_WIDTH_PX,
        layout: BoxLayout({
          direction: Direction.TopToBottom,
          children: [
            Label({
              text: `${createHtmlIcon("fa-keyboard")}&nbsp;&nbsp;Keybindings`,
              textFormat: TextFormat.RichText,
              cssClass: ["h2"]
            }),
            BoxLayout({
              direction: Direction.TopToBottom,
              children: [
                BoxLayout({
                  direction: Direction.LeftToRight,
                  children: [
                    "Keybindings:",
                    shrinkWrap(
                      ComboBox({
                        currentIndex: currentStyleIndex,
                        items: keybindingStyles.map(ks => ks.name),
                        onActivated: (index) => {
                          const styleName = keybindingStyles[index].id;
                          update((config: GeneralConfig) => {
                            config.keybindingsName = styleName;
                          });
                          this.#updateKeybindingInfos(styleName, this.#commandKeybindingsMapping);
                        }
                      })
                    )
                  ]
                }),

                BoxLayout({
                  direction: Direction.LeftToRight,
                  contentsMargins: [0, 0, 0, 0],
                  children: [
                    {
                      widget:
                        stackedWidget = StackedWidget({
                          children: [
                            Widget({
                              layout: BoxLayout({
                                direction: Direction.LeftToRight,
                                contentsMargins: 0,
                                children: [
                                  {
                                    widget: filterLineEdit = LineEdit({
                                      text: "",
                                      placeholderText: "Filter commands by name",
                                      sizePolicy: {
                                        vertical: QSizePolicyPolicy.Fixed,
                                        horizontal:QSizePolicyPolicy.Expanding
                                      },
                                      onTextEdited: (text: string) => {
                                        this.#setSearchText(text.trim());
                                      }
                                    }),
                                    stretch: 1,
                                  },
                                  {
                                    widget: HoverPushButton({
                                      cssClass: ["microtool", "warning"],
                                      iconPair: this.#uiStyle.getBorderlessButtonIconPair("fa-backspace"),
                                      toolTip: "Clear filter",
                                      sizePolicy: {
                                        horizontal: QSizePolicyPolicy.Fixed,
                                        vertical: QSizePolicyPolicy.Fixed,
                                      },
                                      onClicked: () => {
                                        filterLineEdit.setText("");
                                        this.#setSearchText("");
                                      }
                                    }),
                                    stretch: 0
                                  }
                                ]
                              })
                            }),

                            this.#recordLineEdit.getWidget()
                          ]
                        }),
                      stretch: 1
                    },
                    {
                      widget: PushButton({
                        icon: this.#uiStyle.getButtonIcon("fa-keyboard"),
                        cssClass: "small",
                        text: "Record key",
                        onClicked: () => {
                          stackedWidget.setCurrentIndex(1);
                          this.#recordLineEdit.startRecord();
                        }
                      }),
                      stretch: 0
                    }
                  ]
                }),

                this.#createBindingsTable(),
                {
                  widget: Widget({}),
                  stretch: 1
                }
              ]
            })
          ]
        })
      })
    });
  }

  #createCommandKeybindingInfo(bindingsID: LogicalKeybindingsName): Map<string, CommandKeybindingInfo> {
    const allCommands = this.#extensionManager.queryCommands({ });
    const result = new Map<string, CommandKeybindingInfo>();
    const onKeybindingInfoChanged = (command: string) => this.#onKeybindingInfoChanged(command);
    for (const commandContribution of allCommands) {
      const commandKeybindingInfo = new CommandKeybindingInfo(commandContribution.command, commandContribution.title);
      commandKeybindingInfo.onChanged(onKeybindingInfoChanged);
      result.set(commandContribution.command, commandKeybindingInfo);
    }
    return result;
  }

  #updateKeybindingInfos(bindingsID: LogicalKeybindingsName,
      commandKeybindingInfoMap: Map<string, CommandKeybindingInfo>): void {

    const stacked = this.#keybindingsIOManager.getStackedKeybindings(bindingsID);
    const baseKeybindingsSet = stacked.keybindingsSet;
    const customKeybindingsSet = stacked.customKeybindingsSet;

    const allCommands = this.#extensionManager.queryCommands({ });

    const baseMapping = new Map<string, string[]>();
    for (const keybinding of baseKeybindingsSet.bindings) {
      baseMapping.set(keybinding.command, keybinding.keys);
    }

    const customMapping = new Map<string, string[]>();
    for (const keybinding of customKeybindingsSet.customBindings) {
      customMapping.set(keybinding.command, keybinding.keys);
    }

    this.#isSuppressWrites = true;

    for (const commandContribution of allCommands) {
      let baseBindings: string[] = [];
      if (baseMapping.has(commandContribution.command)) {
        baseBindings = baseMapping.get(commandContribution.command);
      }

      let customBindings: string[] = null;
      if (customMapping.has(commandContribution.command)) {
        customBindings = customMapping.get(commandContribution.command);
      }

      const commandKeybindingInfo = commandKeybindingInfoMap.get(commandContribution.command);
      commandKeybindingInfo.baseKeybindingsList = baseBindings;
      commandKeybindingInfo.customKeybindingsList = customBindings;
    }
    this.#isSuppressWrites = false;
  }

  #onKeybindingInfoChanged(command: string): void {
    if (this.#isSuppressWrites) {
      return;
    }
    const newCustomKeybindingsSet = this.#getCustomKeybindingsSet();
    this.#keybindingsIOManager.updateCustomKeybindingsFile(newCustomKeybindingsSet);
  }

  #getCustomKeybindingsSet(): CustomKeybindingsSet {
    const customBindings = [];

    for (const [key, value] of this.#commandKeybindingsMapping.entries()) {
      const customKeys = value.customKeybindingsList;
      if (customKeys != null) {
        customBindings.push({
          command: key,
          keys: customKeys
        });
      }
    }

    return {
      basedOn: this.#keybindingsName,
      customBindings
    };
  }

  #createBindingsTable(): QWidget {
    const categories: Category[] = [
      "global",
      "application",
      "window",
      "terminal",
      "hyperlink",
      "viewer"
    ];

    const categoryToCommandContribsMapping = this.#buildCommandsByCategory();

    for (const category of categories) {
      this.#categoryInfoList.push({
        category,
        title: categoryNames[category],
        commandBindingEditorList: []
      });
    }

    const children: GridLayoutChild[] = [];
    for (const categoryInfo of this.#categoryInfoList) {
      children.push({
        layout: BoxLayout({
          contentsMargins: 0,
          direction: Direction.LeftToRight,
          children: [
            Label({
              cssClass: ["h2"],
              text: categoryInfo.title
            }),
            {
              widget: categoryInfo.countPillLabel = Label({
                cssClass: ["badge", "h2-line"],
                text: "",
                visible: false,
                sizePolicy: {
                  vertical: QSizePolicyPolicy.Fixed,
                  horizontal: QSizePolicyPolicy.Fixed
                }
              }),
              alignment: AlignmentFlag.AlignVCenter
            }
          ]
        }),
        colSpan: 2
      });

      categoryInfo.commandLabel = Label({
        cssClass: ["table-header"],
        text: "Command"
      });
      children.push(categoryInfo.commandLabel);

      categoryInfo.keyLabel = Label({
        cssClass: ["table-header"],
        text: "Key"
      });
      children.push(categoryInfo.keyLabel);

      const commandContribList = categoryToCommandContribsMapping.get(categoryInfo.category) ?? [];
      for (const commandContrib of commandContribList) {
        const bindingInfo = this.#commandKeybindingsMapping.get(commandContrib.command);
        const commandBindingEditor = new CommandBindingEditor(bindingInfo, this.#uiStyle, categoryInfo.category);
        this.#commandBindingEditorMap.set(commandContrib.command, commandBindingEditor);

        categoryInfo.commandBindingEditorList.push(commandBindingEditor);

        children.push(commandBindingEditor.getLabel());
        children.push(commandBindingEditor.getEditor());
      }

      // Extra space
      children.push({
        widget: Label({
          text: ""
        }),
        colSpan: 2
      });
    }

    return Widget({
      contentsMargins: 0,
      layout: GridLayout({
        contentsMargins: [0, 0, 0, 0],
        columns: 2,
        columnsMinimumWidth: [PAGE_WIDTH_PX/2, PAGE_WIDTH_PX/2],
        spacing: 0,
        children
      })
    });
  }

  #buildCommandsByCategory(): Map<Category, ExtensionCommandContribution[]> {
    const allCommands = this.#extensionManager.queryCommands({ });
    const commandsByCategory = new Map<Category, ExtensionCommandContribution[]>();
    for (const contrib of allCommands) {
      if (commandsByCategory.get(contrib.category) == null) {
        commandsByCategory.set(contrib.category, []);
      }
      commandsByCategory.get(contrib.category).push(contrib);
    }
    return commandsByCategory;
  }

  #setSearchText(text: string): void {
    const lowerText = text.toLowerCase();

    const categoryCount = new Map<Category, number>();
    for (const editor of this.#commandBindingEditorMap.values()) {
      editor.setSearchText(lowerText);
      const category = editor.getCategory();
      if (!categoryCount.has(category)) {
        categoryCount.set(category, 0);
      }
      if (editor.isVisible()) {
        categoryCount.set(category, categoryCount.get(category) + 1);
      }
    }

    for (const categoryInfo of this.#categoryInfoList) {
      const count = categoryCount.get(categoryInfo.category) ?? 0;
      categoryInfo.commandLabel.setVisible(count !== 0);
      categoryInfo.keyLabel.setVisible(count !== 0);

      if (lowerText === "") {
        categoryInfo.countPillLabel.setVisible(false);
      } else {
        categoryInfo.countPillLabel.setText(`${count} / ${categoryInfo.commandBindingEditorList.length}`);
        categoryInfo.countPillLabel.setVisible(true);
      }
    }
  }
}
