/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render, TemplateResult, DirectiveFn } from "extraterm-lit-html";
import { repeat } from "extraterm-lit-html/directives/repeat";

import { getLogger } from "extraterm-logging";
import { Logger } from "@extraterm/extraterm-extension-api";
import { ContextMenu } from "../gui/ContextMenu";
import { trimBetweenTags } from "extraterm-trim-between-tags";
import * as DomUtils from "../DomUtils";
import { doLater } from "extraterm-later";
import { ExtensionManager, CommandQueryOptions } from "../extension/InternalTypes";
import { CommandAndShortcut } from "./CommandPalette";
import { KeybindingsManager } from "../keybindings/KeyBindingsManager";
import { CommonExtensionWindowState } from "../extension/CommonExtensionState";
import { ContextMenuType, ContextMenuRequestEventDetail } from "./CommandUtils";
import { ExtensionCommandContribution } from "extraterm/src/ExtensionMetadata";

const ID_APPLICATION_CONTEXT_MENU = "ID_APPLICATION_CONTEXT_MENU";


interface CommandLine {
  type: "command";
  id: string;
  command: CommandAndShortcut;
}

interface DividerLine {
  type: "divider";
  id: string;
}

export class ApplicationContextMenu {
  private _log: Logger;
  private _contextMenuElement: ContextMenu = null
  private _menuEntries: CommandAndShortcut[] = null;
  private _contextWindowState : CommonExtensionWindowState = null;
  private _menuType = ContextMenuType.NORMAL;

  constructor(private extensionManager: ExtensionManager, private keybindingsManager: KeybindingsManager) {
    this._log = getLogger("ApplicationContextMenu", this);

    const contextMenuFragment = DomUtils.htmlToFragment(trimBetweenTags(`
    <${ContextMenu.TAG_NAME} id="${ID_APPLICATION_CONTEXT_MENU}">
    </${ContextMenu.TAG_NAME}>
    `));
    window.document.body.appendChild(contextMenuFragment);
    this._contextMenuElement = <ContextMenu> window.document.getElementById(ID_APPLICATION_CONTEXT_MENU);

    this._contextMenuElement.addEventListener("selected", (ev: CustomEvent) => {
      this._executeMenuCommand(ev.detail.name);

      if (this._contextWindowState != null) {
        this.extensionManager.refocus(this._contextWindowState);
      }
      this._menuEntries = null;
      this._contextWindowState = null;
    });

    this._contextMenuElement.addEventListener("dismissed", (ev: CustomEvent) => {
      if (this._contextWindowState != null) {
        this.extensionManager.refocus(this._contextWindowState);
      }
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
      this._updateMenu(<ContextMenuType> ev.detail.menuType);
      if (this._menuEntries == null) {
        return;
      }
      this._contextMenuElement.open(ev.detail.x, ev.detail.y);
    });
  }

  openAround(el: HTMLElement, menuType: ContextMenuType): void {
    this._menuType = menuType;
    doLater( () => {
      this._updateMenu(menuType);
      if (this._menuEntries == null) {
        return;
      }
      this._contextMenuElement.openAround(el);
    });
  }

  render(): void {
    this._updateMenu(this._menuType);
  }

  private _updateMenu(menuType: ContextMenuType): void {
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

      case ContextMenuType.WINDOW_MENU:
        options.windowMenu = true;
        break;
    }

    let entries: ExtensionCommandContribution[] = null;
    if (this._contextWindowState != null) {
      entries = this.extensionManager.queryCommandsWithExtensionWindowState(options, this._contextWindowState);
    } else {
      entries = this.extensionManager.queryCommands(options);
    }

    const termKeybindingsMapping = this.keybindingsManager.getKeybindingsMapping();
    this._menuEntries = entries.map((entry): CommandAndShortcut => {
      const shortcuts = termKeybindingsMapping.getKeyStrokesForCommand(entry.command);
      const shortcut = (showShortcuts && shortcuts.length !== 0) ? shortcuts[0].formatHumanReadable() : "";
      return { id: entry.command + "_" + entry.category, shortcut, ...entry };
    });

    if (this._menuEntries.length === 0) {
      this._menuEntries = null;
      return;
    }

    render(this._formatMenuHtml(this._menuEntries), this._contextMenuElement);
  }

  private _formatMenuHtml(menuEntries: CommandAndShortcut[]): DirectiveFn | TemplateResult {
    const lines = this._computeCommandAndDividerList(menuEntries);
    return repeat(lines, (line) => line.id,
      (line, index) => {
        if (line.type === "divider") {
          return html`<et-divider-menu-item></et-divider-menu-item>`;
        }
        return this._commandAndShortcutToHtml(line.command);
      });
  }

  private _computeCommandAndDividerList(menuEntries: CommandAndShortcut[]): (CommandLine | DividerLine)[] {
    let lastCategory = "";
    const lines: (CommandLine | DividerLine)[] = [];
    let dividerCounter = 0;
    for (const command of menuEntries) {
      if (command.category !== lastCategory && lastCategory !== "") {
        lines.push( { type: "divider", id: `divider_${dividerCounter}`} );
        dividerCounter++;
      }
      lines.push( {type: "command", id: command.id, command } );
      lastCategory = command.category;
    }
    return lines;
  }

  private _commandAndShortcutToHtml(command: CommandAndShortcut): TemplateResult {
    if (command.checked != null) {
      return html`<et-checkbox-menu-item name=${command.command} icon=${command.icon} ?checked=${command.checked}
        shortcut=${command.shortcut}>${command.title}</et-checkbox-menu-item>`;
    } else {
      return html`<et-menu-item name=${command.command} icon=${command.icon}
        shortcut=${command.shortcut}>${command.title}</et-menu-item>`;
    }
  }

  private _executeMenuCommand(commandName: string): void {
    if (this._menuEntries == null) {
      return;
    }

    const contextWindowState = this._contextWindowState;
    doLater( () => {
      if (contextWindowState != null) {
        this.extensionManager.executeCommandWithExtensionWindowState(contextWindowState, commandName);
      } else {
        this.extensionManager.executeCommand(commandName);
      }
    });
  }
}
