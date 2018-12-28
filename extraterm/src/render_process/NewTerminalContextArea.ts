/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';
import { Logger } from 'extraterm-extension-api';
import { getLogger, log } from 'extraterm-logging';
import { ConfigDatabase, AcceptsConfigDatabase, SESSION_CONFIG } from '../Config';
import { dispatchContextMenuRequest } from './command/CommandUtils';
import { Commandable, BoundCommand } from './command/CommandTypes';


const COMMAND_NEW_TERMINAL = "newTerminal";
const PALETTE_GROUP = "NewTerminalContextArea";

export const EVENT_NEW_SESSION_REQUEST = "EVENT_NEW_SESSION_REQUEST";


@WebComponent({tag: "et-new-terminal-button"})
export class NewTerminalContextArea extends HTMLElement implements Commandable, AcceptsConfigDatabase {

  static TAG_NAME = "et-new-terminal-button";

  private _log: Logger;
  private _configManager: ConfigDatabase = null;

  constructor() {
    super();
    this._log = getLogger("NewTerminalButton", this);
    this._configManager = null;
    this.addEventListener('contextmenu', ev => this._handleContextMenuCapture(ev), true);
  }

  private _handleContextMenuCapture(ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    dispatchContextMenuRequest(this, ev.clientX, ev.clientY);
  }

  setConfigDatabase(configManager: ConfigDatabase): void {
    this._configManager = configManager;
  }

  getCommands(commandableStack: Commandable[]): BoundCommand[] {
    if (this._configManager == null) {
      return [];
    }

    const sessionCommandList: BoundCommand[] = [];
    const sessions = this._configManager.getConfig(SESSION_CONFIG);
    for (let i=0; i<sessions.length; i++) {
      const sessionConfig = sessions[i];
      sessionCommandList.push({
        id: COMMAND_NEW_TERMINAL,
        group: PALETTE_GROUP,
        icon: "fa fa-plus",
        label: "New Terminal: " + sessionConfig.name,
        commandPalette: false,
        contextMenu: true,
        commandExecutor: this,
        commandArguments: {sessionUuid: sessionConfig.uuid},
        shortcut: "",
      });
    }

    return sessionCommandList;
  }

  executeCommand(commandId: string, commandArguments?: any): void {
    if (commandId === COMMAND_NEW_TERMINAL) {
      let sessionUuid = (<any>commandArguments).sessionUuid;
      if (sessionUuid != null) {
        this._dispatchNewSessionRequest(sessionUuid);
      }
    }
  }

  private _dispatchNewSessionRequest(sessionUuid: string):  void {
    const detail = { sessionUuid };
    const newSessionRequestEvent = new CustomEvent(EVENT_NEW_SESSION_REQUEST, {bubbles: true, detail});
    newSessionRequestEvent.initCustomEvent(EVENT_NEW_SESSION_REQUEST, true, true, detail);
    this.dispatchEvent(newSessionRequestEvent);
  }
}
