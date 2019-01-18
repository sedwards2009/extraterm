/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from 'he';

import { Disposable, Logger } from 'extraterm-extension-api';
import { doLater } from '../../utils/DoLater';
import { PopDownListPicker } from '../gui/PopDownListPicker';
import { CssFile } from '../../theme/Theme';
import { isSupportsDialogStack } from '../SupportsDialogStack';
import { ExtensionManager } from '../extension/InternalTypes';
import { KeybindingsManager } from '../keybindings/KeyBindingsManager';
import { getLogger } from 'extraterm-logging';
import { eventToCommandableStack } from './CommandUtils';
import { ExtensionCommandContribution } from '../../ExtensionMetadata';


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
  private _commandPaletteRequestSource: HTMLElement = null;
  private _commandPaletteEntries: CommandAndShortcut[] = [];

  constructor(private extensionManager: ExtensionManager, private keyBindingManager: KeybindingsManager) {

    this._log = getLogger("CommandPalette", this);
    const doc = window.document;
  
    // Command palette
    this._commandPalette = <PopDownListPicker<CommandAndShortcut>> doc.createElement(PopDownListPicker.TAG_NAME);
    this._commandPalette.id = ID_COMMAND_PALETTE;
    this._commandPalette.titlePrimary = "Command Palette";
    
    this._commandPalette.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
    this._commandPalette.setFormatEntriesFunc(commandPaletteFormatEntries);
    this._commandPalette.addExtraCss([CssFile.COMMAND_PALETTE]);
  
    this._commandPalette.addEventListener('selected', (ev: CustomEvent) => this._handleCommandPaletteSelected(ev));
  }

  handleCommandPaletteRequest(ev: CustomEvent): void {
    const commandableStack = eventToCommandableStack(ev);
    const firstCommandable = commandableStack[0];
    if (firstCommandable instanceof HTMLElement) {
      this._commandPaletteRequestSource = firstCommandable;
    }

    doLater( () => {
      const entries = this.extensionManager.queryCommands({
        commandPalette: true,
        categories: ["application", "window", "textEditing", "terminal", "terminalCursorMode", "viewer"]
      });
  
      const entriesAndShortcuts = entries.map((entry): CommandAndShortcut => {
        return { id: entry.command + "_" + entry.category, shortcut: "", ...entry };
      });
      this._commandPaletteEntries = entriesAndShortcuts;
      this._commandPalette.setEntries(entriesAndShortcuts);
      
      const contextElement = commandableStack[commandableStack.length-2];
      if (isSupportsDialogStack(contextElement)) {
        this._commandPaletteDisposable = contextElement.showDialog(this._commandPalette);
      
        this._commandPalette.open();
        this._commandPalette.focus();
      } else {
        this._log.warn("Command palette context element doesn't support DialogStack. ", contextElement);
      }
    });
  }

  private _handleCommandPaletteSelected(ev: CustomEvent): void {
    this._commandPalette.close();
    this._commandPaletteDisposable.dispose();
    this._commandPaletteDisposable = null;
    if (this._commandPaletteRequestSource !== null) {
      this._commandPaletteRequestSource.focus();
    }
    
    const selectedId = ev.detail.selected;
    if (selectedId !== null) {
      doLater( () => {
        for (const entry of this._commandPaletteEntries) {
          if (entry.id === selectedId) {
            this.extensionManager.executeCommand(entry.command);
          }
        }
      });
    }
  }
}


const CLASS_RESULT_GROUP_HEAD = "CLASS_RESULT_GROUP_HEAD";
const CLASS_RESULT_ICON_LEFT = "CLASS_RESULT_ICON_LEFT";
const CLASS_RESULT_ICON_RIGHT = "CLASS_RESULT_ICON_RIGHT";
const CLASS_RESULT_LABEL = "CLASS_RESULT_LABEL";
const CLASS_RESULT_SHORTCUT = "CLASS_RESULT_SHORTCUT";

export function commandPaletteFilterEntries(entries: CommandAndShortcut[], filter: string): CommandAndShortcut[] {
  const lowerFilter = filter.toLowerCase();
  return entries.filter( (entry) => entry.title.toLowerCase().includes(lowerFilter) );
}

export function commandPaletteFormatEntries(entries: CommandAndShortcut[], selectedId: string, filterInputValue: string): string {
    return (filterInputValue.trim() === "" ? commandPaletteFormatEntriesWithGroups : commandPaletteFormatEntriesAsList)(entries, selectedId);
}

function commandPaletteFormatEntriesAsList(entries: CommandAndShortcut[], selectedId: string): string {
  return entries.map( (entry) => commandPaletteFormatEntry(entry, entry.id === selectedId) ).join("");
}

function commandPaletteFormatEntriesWithGroups(entries: CommandAndShortcut[], selectedId: string): string {
  let currentGroup: string = null;
  const htmlParts: string[] = [];

  for (let entry of entries) {
    let extraClass = "";
    if (entry.category !== undefined && entry.category !== currentGroup && currentGroup !== null) {
      extraClass = CLASS_RESULT_GROUP_HEAD;
    }
    currentGroup = entry.category;
    htmlParts.push(commandPaletteFormatEntry(entry, entry.id === selectedId, extraClass));
  }
  
  return htmlParts.join("");
}

function commandPaletteFormatEntry(entry: CommandAndShortcut, selected: boolean, extraClassString = ""): string {
  return `<div class='${PopDownListPicker.CLASS_RESULT_ENTRY} ${selected ? PopDownListPicker.CLASS_RESULT_SELECTED : ""} ${extraClassString}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
    <div class='${CLASS_RESULT_ICON_LEFT}'>${commandPaletteFormatCheckboxIcon(entry.checked)}</div>
    <div class='${CLASS_RESULT_ICON_RIGHT}'>${commandPaletteFormatIcon(entry.icon)}</div>
    <div class='${CLASS_RESULT_LABEL}'>${he.encode(entry.title)}</div>
    <div class='${CLASS_RESULT_SHORTCUT}'>${entry.shortcut !== undefined && entry.shortcut !== null ? he.encode(entry.shortcut) : ""}</div>
  </div>`;
}

function commandPaletteFormatIcon(iconName?: string): string {
  if (iconName != null && iconName.startsWith('extraicon-')) {
    return `<span class='extraicon'>&${iconName.substr('extraicon-'.length)};</span>`;
  } else {
    if (iconName == null) {
      return `<i class='fa-fw fa'>&nbsp;</i>`;
    } else {
      return `<i class='fa-fw ${iconName != null ? iconName : ""}'></i>`;
    }
  }
}

function commandPaletteFormatCheckboxIcon(checked?: boolean): string {
  if (checked == null) {
    return commandPaletteFormatIcon(null);
  } else {
    return commandPaletteFormatIcon(checked ? "far fa-check-square" : "far fa-square");
  }
}
