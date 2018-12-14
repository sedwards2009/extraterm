/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';

import { Disposable, Logger } from 'extraterm-extension-api';
import { doLater } from '../utils/DoLater';
import { CommandEntry, Commandable, isCommandable } from './CommandPaletteRequestTypes';
import { CommandMenuItem, commandPaletteFilterEntries, commandPaletteFormatEntries } from './CommandPaletteFunctions';
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
  private _commandPaletteRequestEntries: CommandEntry[] = null;
  
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
        let result: CommandEntry[] = commandable.getCommandPaletteEntries(commandableStack);
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
