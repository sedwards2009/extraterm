/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import * as he from 'he';

import { Disposable, Logger } from 'extraterm-extension-api';
import { doLater } from '../utils/DoLater';
import { BoundCommand, Commandable, isCommandable, CommandMenuItem } from './CommandPaletteRequestTypes';
import { PopDownListPicker } from './gui/PopDownListPicker';
import { CssFile } from '../theme/Theme';
import { EtTerminal } from './Terminal';
import { TextViewer } from'./viewers/TextAceViewer';
import { isSupportsDialogStack } from './SupportsDialogStack';
import { ExtensionManager } from './extension/InternalTypes';
import { KeybindingsManager } from './keybindings/KeyBindingsManager';
import { getLogger } from 'extraterm-logging';


const ID_COMMAND_PALETTE = "ID_COMMAND_PALETTE";


export class CommandPalette {
  private _log: Logger;
  private _commandPalette: PopDownListPicker<CommandMenuItem> = null;
  private _commandPaletteDisposable: Disposable = null;
  private _commandPaletteRequestSource: HTMLElement = null;
  private _commandPaletteRequestEntries: BoundCommand[] = null;
  
  constructor(private extensionManager: ExtensionManager, private keyBindingManager: KeybindingsManager, 
      private rootCommandable: Commandable) {

    this._log = getLogger("CommandPalette", this);
    const doc = window.document;
  
    // Command palette
    this._commandPalette = <PopDownListPicker<CommandMenuItem>> doc.createElement(PopDownListPicker.TAG_NAME);
    this._commandPalette.id = ID_COMMAND_PALETTE;
    this._commandPalette.titlePrimary = "Command Palette";
    this._commandPalette.titleSecondary = "Ctrl+Shift+P";
    
    this._commandPalette.setFilterAndRankEntriesFunc(commandPaletteFilterEntries);
    this._commandPalette.setFormatEntriesFunc(commandPaletteFormatEntries);
    this._commandPalette.addExtraCss([CssFile.COMMAND_PALETTE]);
  
    this._commandPalette.addEventListener('selected', (ev: CustomEvent) => this._handleCommandPaletteSelected(ev));
  }

  handleCommandPaletteRequest(ev: CustomEvent): void {
    const path = ev.composedPath();
    const requestCommandableStack: Commandable[] = <any> path.filter(el => isCommandable(el));

    doLater( () => {
      const commandableStack: Commandable[] = [...requestCommandableStack, this.rootCommandable];
      
      const firstCommandable = commandableStack[0];
      if (firstCommandable instanceof HTMLElement) {
        this._commandPaletteRequestSource = firstCommandable;
      }

      this._commandPaletteRequestEntries = _.flatten(commandableStack.map(commandable => {
        let result = commandable.getCommandPaletteEntries(commandableStack);
        if (commandable instanceof EtTerminal) {
          result = [...result, ...this.extensionManager.getWorkspaceTerminalCommands(commandable)];
        } else if (commandable instanceof TextViewer) {
          result = [...result, ...this.extensionManager.getWorkspaceTextViewerCommands(commandable)];
        }
        return result;
      }));

      const paletteEntries = this._commandPaletteRequestEntries.map( (entry, index): CommandMenuItem => {
        return {
          id: "" + index,
          group: entry.group,
          iconLeft: entry.iconLeft,
          iconRight: entry.iconRight,
          label: entry.label,
          shortcut: entry.shortcut
        };
      });
      
      const shortcut = this.keyBindingManager.getKeybindingsContexts().context("main-ui").mapCommandToReadableKeyStroke("openCommandPalette");
      this._commandPalette.titleSecondary = shortcut !== null ? shortcut : "";
      this._commandPalette.setEntries(paletteEntries);
      
      const contextElement = requestCommandableStack[requestCommandableStack.length-2];

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
      const commandIndex = Number.parseInt(selectedId);
      const commandEntry = this._commandPaletteRequestEntries[commandIndex];
      doLater( () => {
        commandEntry.commandExecutor.executeCommand(commandEntry.id, commandEntry.commandArguments);
        this._commandPaletteRequestSource = null;
        this._commandPaletteRequestEntries = null;
      });
    }
  }
}

const CLASS_RESULT_GROUP_HEAD = "CLASS_RESULT_GROUP_HEAD";
const CLASS_RESULT_ICON_LEFT = "CLASS_RESULT_ICON_LEFT";
const CLASS_RESULT_ICON_RIGHT = "CLASS_RESULT_ICON_RIGHT";
const CLASS_RESULT_LABEL = "CLASS_RESULT_LABEL";
const CLASS_RESULT_SHORTCUT = "CLASS_RESULT_SHORTCUT";

export function commandPaletteFilterEntries(entries: CommandMenuItem[], filter: string): CommandMenuItem[] {
  const lowerFilter = filter.toLowerCase();
  return entries.filter( (entry) => entry.label.toLowerCase().includes(lowerFilter) );
}

export function commandPaletteFormatEntries(entries: CommandMenuItem[], selectedId: string, filterInputValue: string): string {
    return (filterInputValue.trim() === "" ? commandPaletteFormatEntriesWithGroups : commandPaletteFormatEntriesAsList)(entries, selectedId);
}

function commandPaletteFormatEntriesAsList(entries: CommandMenuItem[], selectedId: string): string {
  return entries.map( (entry) => commandPaletteFormatEntry(entry, entry.id === selectedId) ).join("");
}

function commandPaletteFormatEntriesWithGroups(entries: CommandMenuItem[], selectedId: string): string {
  let currentGroup: string = null;
  const htmlParts: string[] = [];

  for (let entry of entries) {
    let extraClass = "";
    if (entry.group !== undefined && entry.group !== currentGroup && currentGroup !== null) {
      extraClass = CLASS_RESULT_GROUP_HEAD;
    }
    currentGroup = entry.group;
    htmlParts.push(commandPaletteFormatEntry(entry, entry.id === selectedId, extraClass));
  }
  
  return htmlParts.join("");
}

function commandPaletteFormatEntry(entry: CommandMenuItem, selected: boolean, extraClassString = ""): string {
  return `<div class='${PopDownListPicker.CLASS_RESULT_ENTRY} ${selected ? PopDownListPicker.CLASS_RESULT_SELECTED : ""} ${extraClassString}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
    <div class='${CLASS_RESULT_ICON_LEFT}'>${commandPaletteFormatIcon(entry.iconLeft)}</div>
    <div class='${CLASS_RESULT_ICON_RIGHT}'>${commandPaletteFormatIcon(entry.iconRight)}</div>
    <div class='${CLASS_RESULT_LABEL}'>${he.encode(entry.label)}</div>
    <div class='${CLASS_RESULT_SHORTCUT}'>${entry.shortcut !== undefined && entry.shortcut !== null ? he.encode(entry.shortcut) : ""}</div>
  </div>`;
}

function commandPaletteFormatIcon(iconName?: string): string {
  if (iconName != null && iconName.startsWith('extraicon-')) {
    return `<span class='fa-fw CLASS_EXTRAICON'>&${iconName.substr('extraicon-'.length)};</span>`;
  } else {
    if (iconName == null) {
      return `<i class='fa-fw fa'>&nbsp;</i>`;
    } else {
      return `<i class='fa-fw ${iconName != null ? iconName : ""}'></i>`;
    }
  }
}
