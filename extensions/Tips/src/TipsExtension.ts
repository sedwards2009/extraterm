/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  BlockPosture,
  ExtensionBlock,
  ExtensionContext,
  IconName,
  Logger,
  SettingsTab,
  Style,
  Terminal,
} from '@extraterm/extraterm-extension-api';
import { AlignmentFlag, Direction, QLabel, QSizePolicyPolicy, TextFormat } from '@nodegui/nodegui';
import { BoxLayout, ComboBox, Label, PushButton, Widget } from "qt-construct";
import * as path from "node:path";
import * as fs from "node:fs";


let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.terminals.registerBlock("tip-block", newTipBlock);
  context.registerSettingsTab("tips-config", settingsTab);

  context.terminals.onDidCreateTerminal((newTerminal: Terminal) => {
    newTerminal.appendBlock("tip-block", newTerminal);
  });
}

interface TipIcon {
  icon: string;
}

interface TipCommand {
  pc: string;
  macos: string;
  command?: string;
}

interface Tip {
  lines: (string | TipIcon | TipCommand)[];
}

let tipsData: Tip[] = null;

function loadTipsData(): void {
  if (tipsData != null) {
    return;
  }
  const tipsString = fs.readFileSync(path.join(context.extensionPath, "resources/tips.json"), {encoding: "utf8"});
  try {
    tipsData = JSON.parse(tipsString);
  } catch(ex) {
    log.warn(ex);
    tipsData = [
      {
        lines: [
          "tips.json failed to load"
        ]
      }
    ];
  }
}


type Frequency = "every" | "daily" | "never";

const FrequencyValues: readonly Frequency[] = ["every", "daily", "never"];
const FrequencyLabels: string[] = ["Every time", "Daily", "Never"];


interface TipConfig {
  index: number;
  frequency: Frequency;
}

function getConfig(): TipConfig {
  let config = <TipConfig> context.configuration.get();
  if (config == null) {
    config = {
      index: 0,
      frequency: "every"
    };
  }
  return config;
}

function modifyConfig(func: (config: TipConfig) => void): void {
  const config = getConfig();
  func(config);
  context.configuration.set(config);
}

function incTipIndex(): void {
  modifyConfig(config => {
    config.index = (config.index+1) % tipsData.length;
  });
}

function decTipIndex(): void {
  modifyConfig(config => {
    config.index = (config.index-1) % tipsData.length;
  });
}

function newTipBlock(extensionBlock: ExtensionBlock, newTerminal: Terminal): void {
  loadTipsData();
  let contentsLabel: QLabel = null;

  const style = newTerminal.tab.window.style;

  const updateTipText = () => {
    const index = getConfig().index;
    const tip = tipsData[index];
    contentsLabel.setText(formatTip(tip, style));
  };

  extensionBlock.contentWidget = Widget({
    cssClass: ["background"],
    sizePolicy: {
      horizontal: QSizePolicyPolicy.Expanding,
      vertical: QSizePolicyPolicy.Minimum,
    },
    layout: BoxLayout({
      direction: Direction.TopToBottom,
      children: [
        {
          widget: contentsLabel = Label({
            minimumWidth: 1000,
            maximumWidth: 1000,
            alignment: AlignmentFlag.AlignTop | AlignmentFlag.AlignLeft,
            textFormat: TextFormat.RichText,
            wordWrap: true,
            openExternalLinks: true,
            text: "",
          }),
          stretch: 0
        },
        {
          widget: Widget({
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              spacing: 0,
              contentsMargins: [0, 0, 0, 0],
              children: [
                PushButton({
                  icon: style.createQIcon("fa-chevron-left"),
                  cssClass: ["small", "group-left"],
                  onClicked: () => {
                    decTipIndex();
                    updateTipText();
                  }
                }),
                PushButton({
                  icon: style.createQIcon("fa-chevron-right"),
                  cssClass: ["small", "group-right"],
                  onClicked: () => {
                    incTipIndex();
                    updateTipText();
                  }
                }),
                {
                  widget: Widget({}),
                  stretch: 1
                },
                PushButton({
                  icon: style.createQIcon("fa-cog"),
                  cssClass: ["small", "quiet"],
                  onClicked: () => {
                    context.commands.executeCommand("extraterm:window.openSettings", { select: "tips:tips-config" });
                  }
                })
              ]
            })
          }),
          stretch: 0
        }
      ]
    })
  });

  incTipIndex();
  updateTipText();

  extensionBlock.updateMetadata({
    title: "Tip",
    posture: BlockPosture.NEUTRAL,
    icon: "fa-lightbulb"
  });

}

function formatTip(tip: Tip, style: Style): string {
  const textLines: string[] = [];
  for (const line of tip.lines) {
    if (typeof line === "string") {
      textLines.push(line);
    } else if (line["icon"] !== undefined) {
      textLines.push(style.createHtmlIcon(<IconName> (<TipIcon> line).icon));
    } else {
      const command = <TipCommand> line;
      const shortcut = context.application.isMacOS ? command.macos : command.pc;
      textLines.push(`<span class="keycap">&nbsp;${style.createHtmlIcon("fa-keyboard")} ${shortcut}&nbsp;</span>`);
    }
  }
  return style.htmlStyleTag + textLines.join("");
}


function settingsTab(extensionTab: SettingsTab): void {
  const frequency = getConfig().frequency;
  extensionTab.contentWidget = Widget({
    layout: BoxLayout({
      direction: Direction.LeftToRight,
      children: [
        "Show Tips:",
        ComboBox({
          items: FrequencyLabels,
          currentIndex: FrequencyValues.indexOf(frequency),
          onCurrentTextChanged: (newText: string) => {
            const frequency = FrequencyValues[FrequencyLabels.indexOf(newText)];
            modifyConfig(config => {
              config.frequency = frequency;
            });
          }
        }),
        {
          widget: Widget({}),
          stretch: 1
        }
      ]
    })
  });
}
