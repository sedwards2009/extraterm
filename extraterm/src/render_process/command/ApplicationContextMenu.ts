/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as he from "he";

import { getLogger } from "extraterm-logging";
import { Logger } from "extraterm-extension-api";
import { ContextMenu } from "../gui/ContextMenu";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import * as DomUtils from "../DomUtils";
import { doLater } from "extraterm-later";
import { ExtensionManager, CommandQueryOptions } from "../extension/InternalTypes";
import { MenuItem } from "../gui/MenuItem";
import { DividerMenuItem } from "../gui/DividerMenuItem";
import { CheckboxMenuItem } from "../gui/CheckboxMenuItem";
import { CommandAndShortcut } from "./CommandPalette";
import { KeybindingsManager } from "../keybindings/KeyBindingsManager";
import { CommonExtensionWindowState } from "../extension/CommonExtensionState";
import { ContextMenuType, ContextMenuRequestEventDetail } from "./CommandUtils";

const ID_APPLICATION_CONTEXT_MENU = "ID_APPLICATION_CONTEXT_MENU";


export class ApplicationContextMenu {
  private _log: Logger;
  private _contextMenuElement: ContextMenu = null
  private _menuEntries: CommandAndShortcut[] = null;
  private _contextWindowState : CommonExtensionWindowState = null;

  constructor(private extensionManager: ExtensionManager, private keybindingsManager: KeybindingsManager) {
    this._log = getLogger("ApplicationContextMenu", this);
    
    const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_APPLICATION_CONTEXT_MENU}">
    </${ContextMenu.TAG_NAME}>
    `));
    window.document.body.appendChild(contextMenuFragment)
    this._contextMenuElement = <ContextMenu> window.document.getElementById(ID_APPLICATION_CONTEXT_MENU);

    this._contextMenuElement.addEventListener("selected", (ev: CustomEvent) => {
      this._executeMenuCommand(ev.detail.name);

      this.extensionManager.refocus(this._contextWindowState);
      this._menuEntries = null;
      this._contextWindowState = null;
    });

    this._contextMenuElement.addEventListener("dismissed", (ev: CustomEvent) => {
      this.extensionManager.refocus(this._contextWindowState);
      this._menuEntries = null;
      this._contextWindowState = null;
    });
  }

  open(ev: CustomEvent): void {
    this._contextWindowState = this.extensionManager.getExtensionWindowStateFromEvent(ev);

    const detail: ContextMenuRequestEventDetail = ev.detail;
    if (detail.extensionContextOverride != null) {
      for (const key in detail.extensionContextOverride) {
        this._contextWindowState[key] = detail.extensionContextOverride[key];
      }
    }

    doLater( () => {
      const menuType = <ContextMenuType> ev.detail.menuType;
      const options: CommandQueryOptions = {
        when: true
      };

      let showShortcuts = true;
      switch(menuType) {
        case ContextMenuType.NORMAL:
          options.contextMenu = true;
          break;

        case ContextMenuType.NEW_TERMINAL_TAB:
          options.newTerminalMenu = true;
          showShortcuts = false;
          break;

        case ContextMenuType.TERMINAL_TAB:
          options.terminalTitleMenu = true;
          showShortcuts = false;
          break;
      }

      const entries = this.extensionManager.queryCommandsWithExtensionWindowState(options, this._contextWindowState);

      const termKeybindingsMapping = this.keybindingsManager.getKeybindingsMapping();
      this._menuEntries = entries.map((entry): CommandAndShortcut => {
        const shortcuts = termKeybindingsMapping.getKeyStrokesForCommandAndCategory(entry.command, entry.category);
        const shortcut = (showShortcuts && shortcuts.length !== 0) ? shortcuts[0].formatHumanReadable() : "";
        return { id: entry.command + "_" + entry.category, shortcut, ...entry };
      });

      if (this._menuEntries.length === 0) {
        this._menuEntries = null;
        return;
      }
      this._contextMenuElement.innerHTML = this._formatMenuHtml(this._menuEntries);
      this._contextMenuElement.open(ev.detail.x, ev.detail.y);
    });
  }

  private _formatMenuHtml(menuEntries: CommandAndShortcut[]): string {
    const htmlParts: string[] = [];
    let lastCategory = "";
    let index = 0;
    for (const command of menuEntries) {
      if (command.category !== lastCategory && lastCategory !== "") {
        htmlParts.push(`<${DividerMenuItem.TAG_NAME}></${DividerMenuItem.TAG_NAME}>`);
      }
      lastCategory = command.category;
      htmlParts.push(this._commandAndShortcutToHtml("index_" + index, command));
      index++;
    }
    return htmlParts.join("");
  }

  private _commandAndShortcutToHtml(name: string, command: CommandAndShortcut): string {
    if (command.checked != null) {
      return `<${CheckboxMenuItem.TAG_NAME} name="${name}" icon="${command.icon}" checked="${command.checked}"
        shortcut="${command.shortcut}">${he.encode(command.title)}</${CheckboxMenuItem.TAG_NAME}>`;
    } else {
      return `<${MenuItem.TAG_NAME} name="${name}" icon="${command.icon}"
        shortcut="${command.shortcut}">${he.encode(command.title)}</${MenuItem.TAG_NAME}>`;
    }
  }

  private _executeMenuCommand(id: string): void {
    if (this._menuEntries == null || this._contextWindowState == null) {
      return;
    }

    const index = Number.parseInt(id.substr("index_".length), 10);
    const entry = this._menuEntries[index];
    const contextWindowState = this._contextWindowState;
    doLater( () => {
      this.extensionManager.executeCommandWithExtensionWindowState(contextWindowState, entry.command);
    });
  }
}
