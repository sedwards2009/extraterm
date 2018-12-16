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
  
  constructor(private keyBindingManager: KeybindingsManager, private extensionManager: ExtensionManager) {
    this._log = getLogger("ApplicationContextMenu", this);
    
    const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_APPLICATION_CONTEXT_MENU}">
    </${ContextMenu.TAG_NAME}>
    `));
    window.document.body.appendChild(contextMenuFragment)
    this._contextMenuElement = <ContextMenu> window.document.getElementById(ID_APPLICATION_CONTEXT_MENU);
  }

  handleContextMenuRequest(ev: CustomEvent): void {
    const requestCommandableStack = eventToCommandableStack(ev);

    doLater( () => {
      this._menuEntries = commandableStackToBoundCommands(CommandType.CONTEXT_MENU, requestCommandableStack,
                                                           this.extensionManager);
      this._contextMenuElement.innerHTML = this._menuEntries.map(this._boundCommandToHtml).join("");

      this._contextMenuElement.open(ev.detail.x, ev.detail.y);
    });
  }

  private _boundCommandToHtml(command: BoundCommand): string {
    return `<${MenuItem.TAG_NAME}>${he.encode(command.label)}</${MenuItem.TAG_NAME}>`;
  }
}
