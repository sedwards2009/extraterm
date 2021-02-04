/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, TemplateResult, Part } from "extraterm-lit-html";
import { DirectiveFn } from "extraterm-lit-html/lib/directive";
import { repeat } from "extraterm-lit-html/directives/repeat";
import { unsafeHTML } from "extraterm-lit-html/directives/unsafe-html";
import * as fuzzyjs from "fuzzyjs";
import * as he from "he";

import { Disposable, Logger } from "@extraterm/extraterm-extension-api";
import { doLater } from "extraterm-later";
import { PopDownListPicker } from "../gui/PopDownListPicker";
import { CssFile } from "../../theme/Theme";
import { SupportsDialogStack } from "../SupportsDialogStack";
import { ExtensionManager } from "../extension/InternalTypes";
import { KeybindingsManager } from "../keybindings/KeyBindingsManager";
import { getLogger } from "extraterm-logging";
import { ExtensionCommandContribution } from "../../ExtensionMetadata";
import { CommonExtensionWindowState } from "../extension/CommonExtensionState";


const ID_COMMAND_PALETTE = "ID_COMMAND_PALETTE";


export interface CommandAndShortcut extends ExtensionCommandContribution {
  id: string;
  shortcut?: string;
  checked?: boolean;

  markedupLabel: string;
  score: number;
}

const SELECTION_START_MARKER = "\x01";
const SELECTION_END_MARKER = "\x02";
const SELECTION_START_MARKER_REGEX = /&#x1;/g;
const SELECTION_END_MARKER_REGEX = /&#x2;/g;

function cmpScore(a: CommandAndShortcut, b: CommandAndShortcut): number {
  if (a.score === b.score) {
    return 0;
  }
  return a.score < b.score ? -1 : 1;
}


export class CommandPalette {
  private _log: Logger;
  private _commandPalette: PopDownListPicker<CommandAndShortcut> = null;
  private _commandPaletteDisposable: Disposable = null;
  private _extensionWindowState: CommonExtensionWindowState = null;
  private _commandPaletteEntries: CommandAndShortcut[] = [];
  private _returnFocusElement: HTMLElement = null;

  constructor(private extensionManager: ExtensionManager, private keybindingsManager: KeybindingsManager) {
    this._log = getLogger("CommandPalette", this);
    const doc = window.document;

    // Command palette
    this._commandPalette = <PopDownListPicker<CommandAndShortcut>> doc.createElement(PopDownListPicker.TAG_NAME);
    this._commandPalette.id = ID_COMMAND_PALETTE;
    this._commandPalette.titlePrimary = "Command Palette";

    this._commandPalette.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
    this._commandPalette.setFormatEntriesFunc(commandPaletteFormatEntries);
    this._commandPalette.addExtraCss([CssFile.COMMAND_PALETTE]);

    this._commandPalette.addEventListener("selected", (ev: CustomEvent) => this._handleCommandPaletteSelected(ev));
  }

  open(contextElement: SupportsDialogStack, returnFocusElement: HTMLElement): void {
    this._returnFocusElement = returnFocusElement;
    this._extensionWindowState = this.extensionManager.copyExtensionWindowState();

    doLater( () => {
      const entries = this.extensionManager.queryCommandsWithExtensionWindowState({
        commandPalette: true,
        categories: ["application", "hyperlink", "window", "textEditing", "terminal", "terminalCursorMode", "viewer"],
        when: true
      }, this._extensionWindowState);

      const termKeybindingsMapping = this.keybindingsManager.getKeybindingsMapping();
      const entriesAndShortcuts = entries.map((entry): CommandAndShortcut => {
        const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        return { id: entry.command, shortcut, markedupLabel: entry.title, score: 0, ...entry };
      });

      this._commandPaletteEntries = entriesAndShortcuts;
      this._commandPalette.setEntries(entriesAndShortcuts);
      this._commandPaletteDisposable = contextElement.showDialog(this._commandPalette);
      this._commandPalette.filter = "";
      this._commandPalette.open();
      this._commandPalette.focus();
    });
  }

  private _handleCommandPaletteSelected(ev: CustomEvent): void {
    this._commandPalette.close();
    this._commandPaletteDisposable.dispose();
    this._commandPaletteDisposable = null;
    if (this._returnFocusElement != null) {
      this._returnFocusElement.focus();
      this._returnFocusElement = null;
    }

    const selectedId = ev.detail.selected;
    if (selectedId !== null) {
      doLater( () => {
        for (const entry of this._commandPaletteEntries) {
          if (entry.id === selectedId) {
            this.extensionManager.executeCommandWithExtensionWindowState(this._extensionWindowState, entry.command);
            break;
          }
        }
        this._extensionWindowState = null;
      });
    } else {
      this._extensionWindowState = null;
    }
  }
}

export function commandPaletteFilterEntries(entries: CommandAndShortcut[], filterText: string): CommandAndShortcut[] {
  if (filterText.trim() === "") {
    let i = 0;
    for (const entry of entries) {
      entry.score = i;
      entry.markedupLabel = entry.title;
      i++;
    }
    return [...entries];

  } else {
    for (const entry of entries) {
      const result = fuzzyjs.match(filterText, entry.title, { withRanges: true });
      if (result.match) {
        entry.score = result.score;
        const ranges = result.ranges;
        entry.markedupLabel = fuzzyjs.surround(entry.title,
          {
            result: {
              ranges
            },
            prefix: SELECTION_START_MARKER,
            suffix: SELECTION_END_MARKER
          }
        );
      } else {
        entry.score = -1;
        entry.markedupLabel = entry.title;
      }
    }

    const resultEntries = entries.filter(e => e.score !== -1);
    resultEntries.sort(cmpScore);
    return resultEntries;
  }
}

export function commandPaletteFormatEntries(entries: CommandAndShortcut[], selectedId: string, filter: string): DirectiveFn | TemplateResult {
  if (filter.trim() === "") {
    return commandPaletteFormatEntriesWithGroups(entries, selectedId);
  } else {
    return commandPaletteFormatEntriesAsList(entries, selectedId);
  }
}

function commandPaletteFormatEntriesAsList(filteredEntries: CommandAndShortcut[], selectedId: string): DirectiveFn | TemplateResult {
  return repeat(
    filteredEntries,
    (entry) => entry.id,
    (entry, index) => {
      const label = markupLabel(entry.markedupLabel);
      return commandPaletteFormatEntry(entry, entry.id === selectedId, unsafeHTML(label));
    }
  );
}

function markupLabel(rawLabel: string): string {
  return he.encode(rawLabel).replace(SELECTION_START_MARKER_REGEX, "<span class='CLASS_MATCHING_TEXT'>")
    .replace(SELECTION_END_MARKER_REGEX, "</span>");
}

function commandPaletteFormatEntriesWithGroups(entries: CommandAndShortcut[], selectedId: string): DirectiveFn | TemplateResult {
  let currentGroup: string = null;
  return repeat(entries, (entry) => entry.id, (entry, index) => {
    let extraClass = "";
    if (entry.category !== undefined && entry.category !== currentGroup && currentGroup !== null) {
      extraClass = "CLASS_RESULT_GROUP_HEAD";
    }
    currentGroup = entry.category;

    return commandPaletteFormatEntry(entry, entry.id === selectedId, entry.title, extraClass);
  });
}

type LabelPart = string | ((part: Part) => void);

function commandPaletteFormatEntry(entry: CommandAndShortcut, selected: boolean, label: LabelPart,
    extraClassString = ""): TemplateResult {

  const classes = PopDownListPicker.CLASS_RESULT_ENTRY + " " +
      (selected ? PopDownListPicker.CLASS_RESULT_SELECTED : "") + " " + extraClassString;

  return html`<div class=${classes} data-id=${entry.id}>
    <div class="CLASS_RESULT_ICON_LEFT">${commandPaletteFormatCheckboxIcon(entry.checked)}</div>
    <div class="CLASS_RESULT_ICON_RIGHT">${commandPaletteFormatIcon(entry.icon)}</div>
    <div class="CLASS_RESULT_LABEL">${label}</div>
    <div class="CLASS_RESULT_SHORTCUT">${entry.shortcut || ""}</div>
  </div>`;
}

function commandPaletteFormatIcon(iconName?: string): TemplateResult {
  if (iconName != null && iconName.startsWith("extraicon-")) {
    return html`<span class="extraicon">${unsafeHTML("&" + iconName.substr("extraicon-".length))}</span>`;
  } else {
    if (iconName == null || iconName === "") {
      return html`<i class="fa-fw fa">&nbsp;</i>`;
    } else {
      return html`<i class=${"fa-fw " + iconName || ""}></i>`;
    }
  }
}

function commandPaletteFormatCheckboxIcon(checked?: boolean): TemplateResult {
  if (checked == null) {
    return commandPaletteFormatIcon(null);
  } else {
    return commandPaletteFormatIcon(checked ? "far fa-check-square" : "far fa-square");
  }
}
