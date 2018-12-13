/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';

import { ConfigDatabaseImpl } from "./MainConfig";
import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { GeneralConfig } from "../Config";
import { GENERAL_CONFIG } from "../Config";
import { ConfigChangeEvent } from "../Config";
import { KeyStroke } from "../keybindings/KeybindingsMapping";
import { KeybindingsMapping } from "../keybindings/KeybindingsMapping";
import { getLogger, Logger } from "extraterm-logging";
import { EventEmitter } from '../utils/EventEmitter';
import { Event } from 'extraterm-extension-api';
import { globalShortcut } from 'electron';


export class GlobalKeybindingsManager {

  private _log: Logger = null;
  private _configuredKeybindingsName = "";

  private _onToggleShowHideWindowEventEmitter = new EventEmitter<null>();
  onToggleShowHideWindow: Event<null>;
  private _onShowWindowEventEmitter = new EventEmitter<null>();
  onShowWindow: Event<null>;
  private _onHideWindowEventEmitter = new EventEmitter<null>();
  onHideWindow: Event<null>;

  constructor(private keybindingsIOManager: KeybindingsIOManager, private configDatabase: ConfigDatabaseImpl) {
    this._log = getLogger("GlobalKeybindingsManager", this);

    this.onToggleShowHideWindow = this._onToggleShowHideWindowEventEmitter.event;
    this.onShowWindow = this._onShowWindowEventEmitter.event;
    this.onHideWindow = this._onHideWindowEventEmitter.event;

    this._createGlobalKeybindings();
  
    keybindingsIOManager.onUpdate((name: string) => {
      this._createGlobalKeybindings();
    });
  
    configDatabase.onChange((e: ConfigChangeEvent) => {
      if (e.key === GENERAL_CONFIG) {
        const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
        if (generalConfig.keybindingsName !== this._configuredKeybindingsName) {
          this._createGlobalKeybindings();
        }
      }
    });
  }

  private _createGlobalKeybindings(): void {
    globalShortcut.unregisterAll();
    const generalConfig = <GeneralConfig> this.configDatabase.getConfig(GENERAL_CONFIG);
    const keybindings = this.keybindingsIOManager.readKeybindingsJson(generalConfig.keybindingsName);
    const globalKeybindings = new KeybindingsMapping(KeyStroke.parseConfigString, "global", keybindings,
                                                      process.platform);
  
    const commandsToEmitters = {
      "globalToggleShowHide": this._onToggleShowHideWindowEventEmitter,
      "globalShow": this._onShowWindowEventEmitter,
      "globalHide": this._onHideWindowEventEmitter,
    };

    for (const command in commandsToEmitters) {
      for (const keyStroke of globalKeybindings.getKeyStrokesForCommand(command)) {
        globalShortcut.register(keyStrokeToAccelerator(keyStroke), () => {
          commandsToEmitters[command].fire(null);
        });
      }
    }
  }
}

const keyHumanNames = {
  "pageup": "PageUp",
  "pagedown": "PageDown",
};


export function keyStrokeToAccelerator(keyStroke: KeyStroke): string {
  const parts: string[] = [];
  if (keyStroke.ctrlKey) {
    parts.push("Ctrl");
  }
  if (keyStroke.metaKey) {
    parts.push("Cmd");
  }
  if (keyStroke.altKey) {
    parts.push("Alt");
  }
  if (keyStroke.shiftKey) {
    parts.push("Shift");
  }

  if (keyStroke.configKeyLowercase in keyHumanNames) {
    parts.push(keyHumanNames[keyStroke.configKeyLowercase]);
  } else {
    parts.push(_.capitalize(keyStroke.configKey));
  }
  return parts.join("+");
}
