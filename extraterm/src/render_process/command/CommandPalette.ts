/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, TemplateResult } from "extraterm-lit-html";
import { DirectiveFn } from "extraterm-lit-html/lib/directive";
import { repeat } from "extraterm-lit-html/directives/repeat";
import { unsafeHTML } from "extraterm-lit-html/directives/unsafe-html";

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
      const entries = this.extensionManager.queryCommands({
        commandPalette: true,
        categories: ["application", "window", "textEditing", "terminal", "terminalCursorMode", "viewer"],
        when: true
      });

      const termKeybindingsMapping = this.keybindingsManager.getKeybindingsMapping();
      const entriesAndShortcuts = entries.map((entry): CommandAndShortcut => {
        const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
        const shortcut = shortcuts.length !== 0 ? shortcuts[0].formatHumanReadable() : "";
        return { id: entry.command, shortcut, ...entry };
      });

      this._commandPaletteEntries = entriesAndShortcuts;
      this._commandPalette.setEntries(entriesAndShortcuts);
      this._commandPaletteDisposable = contextElement.showDialog(this._commandPalette);
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

export function commandPaletteFilterEntries(entries: CommandAndShortcut[], filter: string): CommandAndShortcut[] {
  const lowerFilter = filter.toLowerCase();
  return entries.filter( (entry) => entry.title.toLowerCase().includes(lowerFilter) );
}

export function commandPaletteFormatEntries(entries: CommandAndShortcut[], selectedId: string, filter: string): DirectiveFn | TemplateResult {
  if (filter.trim() === "") {
    return commandPaletteFormatEntriesWithGroups(entries, selectedId);
  } else {
    return commandPaletteFormatEntriesAsList(entries, selectedId);
  }
}

function commandPaletteFormatEntriesAsList(entries: CommandAndShortcut[], selectedId: string): DirectiveFn | TemplateResult {
  return repeat(entries, (entry) => entry.id, (entry, index) => commandPaletteFormatEntry(entry, entry.id === selectedId));
}

function commandPaletteFormatEntriesWithGroups(entries: CommandAndShortcut[], selectedId: string): DirectiveFn | TemplateResult {
  let currentGroup: string = null;
  return repeat(entries, (entry) => entry.id, (entry, index) => {
    let extraClass = "";
    if (entry.category !== undefined && entry.category !== currentGroup && currentGroup !== null) {
      extraClass = "CLASS_RESULT_GROUP_HEAD";
    }
    currentGroup = entry.category;

    return commandPaletteFormatEntry(entry, entry.id === selectedId, extraClass);
  });
}

function commandPaletteFormatEntry(entry: CommandAndShortcut, selected: boolean, extraClassString = ""): TemplateResult {
  const classes = PopDownListPicker.CLASS_RESULT_ENTRY + " " +
      (selected ? PopDownListPicker.CLASS_RESULT_SELECTED : "") + " " + extraClassString;

  return html`<div class=${classes} data-id=${entry.id}>
    <div class="CLASS_RESULT_ICON_LEFT">${commandPaletteFormatCheckboxIcon(entry.checked)}</div>
    <div class="CLASS_RESULT_ICON_RIGHT">${commandPaletteFormatIcon(entry.icon)}</div>
    <div class="CLASS_RESULT_LABEL">${entry.title}</div>
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
