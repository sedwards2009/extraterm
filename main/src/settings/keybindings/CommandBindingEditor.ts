/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QLabel, QPushButton, QSizePolicyPolicy, QStackedWidget, QWidget, TextFormat
} from "@nodegui/nodegui";
import { BoxLayout, Label, StackedWidget, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { UiStyle } from "../../ui/UiStyle.js";
import { HoverPushButton } from "../../ui/QtConstructExtra.js";
import { CommandKeybindingInfo } from "./CommandKeybindingInfo.js";
import { KeyRecord } from "./KeyRecord.js";
import { Category } from "../../extension/ExtensionMetadata.js";
import { createHtmlIcon } from "../../ui/Icons.js";
import { TermKeyStroke } from "../../keybindings/KeybindingsManager.js";
import { Emulator, Platform } from "../../emulator/Term.js";


export class CommandBindingEditor {
  #category: Category;
  #label: QLabel = null;
  #editor: QStackedWidget = null;
  #bindingInfo: CommandKeybindingInfo = null;
  #plusButton: QPushButton = null;
  #revertButton: QPushButton = null;
  #boxLayout: QBoxLayout = null;
  #spacerWidget: QWidget = null;

  #topItemLayout: QBoxLayout = null;

  #recordLineEdit: KeyRecord = null;
  #isEditState = false;
  #uiStyle: UiStyle = null;
  private _log: Logger;

  #isVisible = true;
  #isWritingBindingInfo = false;

  constructor(bindingInfo: CommandKeybindingInfo, uiStyle: UiStyle, category: Category) {
    this._log = getLogger("CommandBindingEditor", this);

    this.#bindingInfo = bindingInfo;
    this.#uiStyle = uiStyle;
    this.#category = category;

    this.#label = Label({
      cssClass: ["table-item"],
      text: this.#bindingInfo.commandTitle
    });

    this.#recordLineEdit = new KeyRecord();
    this.#recordLineEdit.onKeyPress(this.#onRecordKeyPress.bind(this));
    this.#recordLineEdit.onRecordCancelled(() => {
      this.#isEditState = false;
      this.#syncUI();
    });

    this.#editor = StackedWidget({
      cssClass: ["table-item"],
      children:[
        Widget({
          layout:
            this.#boxLayout = BoxLayout({
              direction: Direction.TopToBottom,
              contentsMargins: [0, 0, 0, 0],
              children: [
                Widget({
                  layout: this.#topItemLayout = BoxLayout({
                    direction: Direction.LeftToRight,
                    contentsMargins: [0, 0, 0, 0],
                    children: []
                  })
                })
              ]
            })
        }),

        this.#recordLineEdit.getWidget()
      ]
    });
    bindingInfo.onChanged(() => {
      if (this.#isWritingBindingInfo) {
        return;
      }
      this.#syncUI();
    });
    this.#syncUI();
  }

  getLabel(): QLabel {
    return this.#label;
  }

  getEditor(): QWidget {
    return this.#editor;
  }

  getCategory(): Category {
    return this.#category;
  }

  isVisible(): boolean {
    return this.#isVisible;
  }

  #getPlusButton(): QPushButton {
    if (this.#plusButton == null) {
      this.#plusButton = HoverPushButton({
        cssClass: ["microtool", "success"],
        iconPair: this.#uiStyle.getBorderlessButtonIconPair("fa-plus"),
        toolTip: "Add keybinding",
        onClicked: () => {
          this.#isEditState = true;
          this.#syncUI();
        }
      });
    }
    return this.#plusButton;
  }

  #getRevertButton(): QPushButton {
    if (this.#revertButton == null) {
      this.#revertButton = HoverPushButton({
        cssClass: ["microtool", "warning"],
        iconPair: this.#uiStyle.getBorderlessButtonIconPair("fa-undo"),
        toolTip: "Revert keybinding",
        onClicked: () => {
          this.#isWritingBindingInfo = true;
          this.#bindingInfo.customKeybindingsList = null;
          this.#isWritingBindingInfo = false;
          this.#syncUI();
        }
      });
    }
    return this.#revertButton;
  }

  #getSpacerWidget(): QWidget {
    if (this.#spacerWidget == null) {
      this.#spacerWidget = Widget({});
    }
    return this.#spacerWidget;
  }

  #onRecordKeyPress(keyCode: string): void {
    this._log.debug(`keyCode: ${keyCode}`);
    this.#isWritingBindingInfo = true;

    this.#isWritingBindingInfo = true;
    if (this.#bindingInfo.customKeybindingsList == null) {
      this.#bindingInfo.customKeybindingsList = [...this.#bindingInfo.baseKeybindingsList, keyCode];
    } else {
      this.#bindingInfo.customKeybindingsList = [...this.#bindingInfo.customKeybindingsList, keyCode];
    }
    this.#isWritingBindingInfo = false;

    this.#isEditState = false;
    this.#recordLineEdit.endRecord();
    this.#syncUI();
  }

  setSearchText(text: string): void {
    const customKeyStrokeList = this.#bindingInfo.customKeyStrokeList;
    const currentKeyStrokeList = customKeyStrokeList ?? this.#bindingInfo.baseKeyStrokeList;
    const keyStrokeMatch = currentKeyStrokeList.some(
      (keyStroke) => keyStroke.formatHumanReadable().toLowerCase().includes(text));
    const visible = text === "" || keyStrokeMatch || this.#bindingInfo.commandTitle.toLowerCase().includes(text);

    this.#isVisible = visible;
    this.#label.setVisible(visible);
    this.#editor.setVisible(visible);
  }

  #keycapLabelMap = new Map<string, { widget: QWidget, layout: QBoxLayout, warningLabel: QLabel }>();

  #syncUI(): void {
    const plusButton = this.#getPlusButton();
    plusButton.setParent(null);

    const revertButton = this.#getRevertButton();
    revertButton.setParent(null);

    const spacerWidget = this.#getSpacerWidget();
    spacerWidget.setParent(null);

    for (const labelPair of this.#keycapLabelMap.values()) {
      labelPair.widget.setParent(null);
    }

    if (this.#isEditState) {
      this.#editor.setCurrentIndex(1);
      this.#recordLineEdit.startRecord();
    } else {
      this.#editor.setCurrentIndex(0);
      const customKeyStrokeList = this.#bindingInfo.customKeyStrokeList;
      const currentKeybindingList = this.#bindingInfo.customKeybindingsList ?? this.#bindingInfo.baseKeybindingsList;
      const currentKeyStrokeList = customKeyStrokeList ?? this.#bindingInfo.baseKeyStrokeList;

      for (let i=0; i<currentKeyStrokeList.length; i++) {
        const keybinding = currentKeybindingList[i];
        const keyStroke = currentKeyStrokeList[i];
        const text = keyStroke.formatHumanReadable();

        if (!this.#keycapLabelMap.has(text)) {
          let layout: QBoxLayout = null;
          let warningLabel: QLabel = null;
          const widget = Widget({
            layout: layout = BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: [0, 0, 0, 0],
              children: [
                {
                  widget: warningLabel = Label({
                    text: createHtmlIcon("fa-exclamation-triangle"),
                    textFormat: TextFormat.RichText,
                    visible: false,
                    toolTip: "This may override the terminal emulation"
                  }),
                  stretch: 0
                },
                {
                  widget: Label({
                    sizePolicy: {
                      horizontal: QSizePolicyPolicy.Fixed,
                      vertical: QSizePolicyPolicy.Fixed,
                    },
                    cssClass: ["keycap"],
                    text
                  }),
                  stretch: 0
                },
                {
                  widget: HoverPushButton({
                    cssClass: ["microtool", "danger"],
                    iconPair: this.#uiStyle.getBorderlessButtonIconPair("fa-times"),
                    toolTip: "Remove keybinding",
                    sizePolicy: {
                      horizontal: QSizePolicyPolicy.Fixed,
                      vertical: QSizePolicyPolicy.Fixed,
                    },
                    onClicked: () => {
                      this.#isWritingBindingInfo = true;
                      const info = this.#bindingInfo;
                      if (info.customKeybindingsList == null) {
                        info.customKeybindingsList = info.baseKeybindingsList.filter(kb => kb !== keybinding);
                      } else {
                        info.customKeybindingsList = info.customKeybindingsList.filter(kb => kb !== keybinding);
                      }
                      this.#isWritingBindingInfo = false;
                      this.#syncUI();
                    }
                  }),
                  stretch: 0
                },
                {
                  widget: Widget({minimumWidth: 0}),
                  stretch: 1
                }
              ]
            })
          });

          this.#keycapLabelMap.set(text, {widget, layout, warningLabel});
        }

        const labelPair = this.#keycapLabelMap.get(text);
        if (i === 0) {
          if (customKeyStrokeList != null) {
            this.#topItemLayout.addWidget(revertButton);
            revertButton.show();
          }

          this.#topItemLayout.addWidget(labelPair.widget);
          labelPair.layout.setStretch(3, 0);

          this.#topItemLayout.addWidget(plusButton);
          plusButton.show();

          this.#topItemLayout.addWidget(spacerWidget, 1);
          spacerWidget.show();
        } else {
          this.#boxLayout.addWidget(labelPair.widget);
          labelPair.layout.setStretch(3, 1);
        }
        labelPair.warningLabel.setVisible(this.#isTermConflict(keyStroke));
      }

      if (currentKeyStrokeList.length === 0) {
        if (customKeyStrokeList != null) {
          this.#topItemLayout.addWidget(revertButton);
          revertButton.show();
        }
        this.#topItemLayout.addWidget(plusButton);
        plusButton.show();

        this.#topItemLayout.addWidget(spacerWidget, 1);
        spacerWidget.show();
      }
    }
  }

  #isTermConflict(keybinding: TermKeyStroke): boolean {
    const excludedCategories: Category[] = ["application", "window", "terminal", "viewer"];
    if (excludedCategories.indexOf(this.#category) === -1) {
      return false;
    }

    return Emulator.isKeySupported(<Platform> process.platform, keybinding);
  }
}
