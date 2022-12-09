/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  Logger,
  SettingsTab,
  Style,
  TerminalSettings
} from "@extraterm/extraterm-extension-api";
import { BoxLayout, CheckBox, GridLayout, Label, PushButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";
import { Direction, QGridLayout, QWidget } from "@nodegui/nodegui";
import { createUuid } from "extraterm-uuid";

import { ColorRule, Config } from "./Config.js";
import { ColorPatchPopup } from "./ColorPatchPopup.js";
import { RuleEditor } from "./RuleEditor.js";


export class ColorizerSettingsPage {
  #log: Logger = null;
  #terminalSettings: TerminalSettings = null;

  #onConfigChangedEventEmitter = new EventEmitter<Config>();
  onConfigChanged: Event<Config> = null;
  #colorPatchPopup: ColorPatchPopup = null;

  #config: Config = null;
  #ruleEditors: RuleEditor[] = [];
  #gridLayout: QGridLayout = null;

  #extensionTab: SettingsTab = null;

  constructor(extensionTab: SettingsTab, config: Config, terminalSettings: TerminalSettings,
      log: Logger) {

    this.#log = log;
    this.#extensionTab = extensionTab;
    this.#config = config;
    this.#terminalSettings = terminalSettings;
    this.onConfigChanged = this.#onConfigChangedEventEmitter.event;
    this.#colorPatchPopup = new ColorPatchPopup(terminalSettings, log);
    extensionTab.contentWidget = this.#createUI();
  }

  #createUI(): QWidget {
    const children = [];
    for (const rule of this.#config.rules) {
      const ruleEditor = this.#createRuleEditor(rule);
      this.#ruleEditors.push(ruleEditor);

      children.push(ruleEditor.getPatternEditor());
      children.push(ruleEditor.getForegroundEditor());
      children.push(ruleEditor.getBackgroundEditor());
      children.push(ruleEditor.getStyleEditor());
      children.push(ruleEditor.getDeleteButton());
    }

    return Widget({
      maximumWidth: 800,
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        children:[
          CheckBox({
            text: "Enabled",
            checked: this.#config.enabled,
            onStateChanged: (enabled: number) => {
              this.#config.enabled = enabled !== 0;
              this.#onConfigChangedEventEmitter.fire(this.#config);
            }
          }),
          Widget({
            contentsMargins: 0,
            layout: this.#gridLayout = GridLayout({
              contentsMargins: 0,
              columns: 5,
              // columnsMinimumWidth: [PAGE_WIDTH_PX/2, PAGE_WIDTH_PX/2],
              spacing: 0,
              columnsStretch: [1, 0, 0, 0, 0],
              children: [
                Label({
                  cssClass: ["table-header"],
                  text: "Pattern"
                }),
                Label({
                  cssClass: ["table-header"],
                  text: "Foreground"
                }),
                Label({
                  cssClass: ["table-header"],
                  text: "Background"
                }),
                Label({
                  cssClass: ["table-header"],
                  text: "Style"
                }),
                Label({
                  cssClass: ["table-header"],
                  text: ""
                }),
                ...children
              ]
            })
          }),

          Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              spacing: 0,
              children: [
                {
                  widget: PushButton({
                    text: "New Color Rule",
                    onClicked: () => {
                      const newRule: ColorRule = {
                        uuid: createUuid(),
                        pattern: "",
                        foreground: 1,
                        background: null,
                        isCaseSensitive: false,
                        isRegex: false,
                        isBold: false,
                        isItalic: false,
                        isUnderline: false
                      };
                      this.#config.rules.push(newRule);
                      const ruleEditor = this.#createRuleEditor(newRule);
                      this.#ruleEditors.push(ruleEditor);

                      const lastRow = this.#config.rules.length;  // Row 0 is header
                      this.#gridLayout.addWidget(ruleEditor.getPatternEditor(), lastRow, 0);
                      this.#gridLayout.addWidget(ruleEditor.getForegroundEditor(), lastRow, 1);
                      this.#gridLayout.addWidget(ruleEditor.getBackgroundEditor(), lastRow, 2);
                      this.#gridLayout.addWidget(ruleEditor.getStyleEditor(), lastRow, 3);
                      this.#gridLayout.addWidget(ruleEditor.getDeleteButton(), lastRow, 4);

                      this.#onConfigChangedEventEmitter.fire(this.#config);
                    },
                  }),
                  stretch: 0
                },
                {
                  widget: Widget({}),
                  stretch: 1
                }
              ]
            })
          })
        ]
      })
    });
  }

  #createRuleEditor(rule: ColorRule): RuleEditor {
    const ruleEditor = new RuleEditor(rule, this.#terminalSettings, this.#colorPatchPopup, this.#extensionTab.style,
      this.#log);

    ruleEditor.onChanged(() => {
      this.#onConfigChangedEventEmitter.fire(this.#config);
    });

    ruleEditor.onDeleteClicked((uuid: string) => {
      ruleEditor.getPatternEditor().setParent(null);
      ruleEditor.getForegroundEditor().setParent(null);
      ruleEditor.getBackgroundEditor().setParent(null);
      ruleEditor.getStyleEditor().setParent(null);
      ruleEditor.getDeleteButton().setParent(null);
      this.#config.rules = this.#config.rules.filter(r => r.uuid !== uuid);
      this.#onConfigChangedEventEmitter.fire(this.#config);
    });
    return ruleEditor;
  }
}
