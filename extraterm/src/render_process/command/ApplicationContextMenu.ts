/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from 'he';

import { KeybindingsManager } from "../keybindings/KeyBindingsManager";
import { getLogger } from 'extraterm-logging';
import { Logger } from 'extraterm-extension-api';
import { ContextMenu } from "../gui/ContextMenu";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import * as DomUtils from '../DomUtils';
import { eventToCommandableStack, commandableStackToBoundCommands, CommandType } from "./CommandUtils";
import { Commandable, BoundCommand } from "./CommandTypes";
import { doLater } from "../../utils/DoLater";
import { ExtensionManager } from "../extension/InternalTypes";
import { MenuItem } from '../gui/MenuItem';


const ID_APPLICATION_CONTEXT_MENU = "ID_APPLICATION_CONTEXT_MENU";


export class ApplicationContextMenu {
  private _log: Logger;
  private _contextMenuElement: ContextMenu = null
  private _menuEntries: BoundCommand[] = null;
  
  constructor(private extensionManager: ExtensionManager) {
    this._log = getLogger("ApplicationContextMenu", this);
    
    const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_APPLICATION_CONTEXT_MENU}">
    </${ContextMenu.TAG_NAME}>
    `));
    window.document.body.appendChild(contextMenuFragment)
    this._contextMenuElement = <ContextMenu> window.document.getElementById(ID_APPLICATION_CONTEXT_MENU);

    this._contextMenuElement.addEventListener("selected", (ev: CustomEvent) => {
      this._executeMenuCommand(ev.detail.name);
    });

    this._contextMenuElement.addEventListener("close", () => {
      const oldMenuEntries = this._menuEntries;
      // We do this to avoid holding refs to objects after the context menu has closed. (-> GC). The delay
      // is needed because a 'selected' event may need the list immediately after this 'close' event.
      doLater( () => {
        if (oldMenuEntries === this._menuEntries) {
          this._menuEntries = null;
        }
      });
    });
  }

  handleContextMenuRequest(ev: CustomEvent): void {
    const requestCommandableStack = eventToCommandableStack(ev);

    doLater( () => {
      this._menuEntries = commandableStackToBoundCommands(CommandType.CONTEXT_MENU, requestCommandableStack,
                                                           this.extensionManager);
      this._contextMenuElement.innerHTML = this._menuEntries.map(
        (command: BoundCommand, index: number): string => this._boundCommandToHtml("index_" + index, command)).join("");
      this._contextMenuElement.open(ev.detail.x, ev.detail.y);
    });
  }

  private _boundCommandToHtml(name: string, command: BoundCommand): string {
    return `<${MenuItem.TAG_NAME} name="${name}" shortcut="${command.shortcut}">${he.encode(command.label)}</${MenuItem.TAG_NAME}>`;
  }

  private _executeMenuCommand(id: string): void {
    if (this._menuEntries == null) {
      return;
    }

    const index = Number.parseInt(id.substr("index_".length), 10);
    const boundCommand = this._menuEntries[index];
    doLater( () => {
      boundCommand.commandExecutor.executeCommand(boundCommand.id, boundCommand.commandArguments);
    });
  }
}
