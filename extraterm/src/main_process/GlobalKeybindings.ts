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
import { KeyStroke, KeybindingsMapping } from "../keybindings/KeybindingsMapping";
import { getLogger, Logger } from "extraterm-logging";
import { EventEmitter } from '../utils/EventEmitter';
import { Event } from '@extraterm/extraterm-extension-api';
import { globalShortcut } from 'electron';
import { doLater } from 'extraterm-later';
import { TermKeybindingsMapping } from '../render_process/keybindings/KeyBindingsManager';


export class GlobalKeybindingsManager {

  private _log: Logger = null;
  private _enabled = true;
  private _configuredKeybindingsName = "";

  private _onToggleShowHideWindowEventEmitter = new EventEmitter<void>();
  onToggleShowHideWindow: Event<void>;
  private _onShowWindowEventEmitter = new EventEmitter<void>();
  onShowWindow: Event<void>;
  private _onHideWindowEventEmitter = new EventEmitter<void>();
  onHideWindow: Event<void>;
  private _onMaximizeEventEmitter = new EventEmitter<void>();
  onMaximizeWindow: Event<void>;

  constructor(private keybindingsIOManager: KeybindingsIOManager, private configDatabase: ConfigDatabaseImpl) {
    this._log = getLogger("GlobalKeybindingsManager", this);

    this.onMaximizeWindow = this._onMaximizeEventEmitter.event;
    this.onHideWindow = this._onHideWindowEventEmitter.event;
    this.onShowWindow = this._onShowWindowEventEmitter.event;
    this.onToggleShowHideWindow = this._onToggleShowHideWindowEventEmitter.event;

    this._updateGlobalKeybindings();

    keybindingsIOManager.onUpdate(() => {
      this._updateGlobalKeybindings();
    });

    configDatabase.onChange((e: ConfigChangeEvent) => {
      if (e.key === GENERAL_CONFIG) {
        const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
        if (generalConfig.keybindingsName !== this._configuredKeybindingsName) {
          this._updateGlobalKeybindings();
        }
      }
    });
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this._enabled) {
      return;
    }
    this._enabled = enabled;
    this._updateGlobalKeybindings();
  }

  private _updateGlobalKeybindings(): void {
    if (this._enabled) {
      this._createGlobalKeybindings();
    } else {
      globalShortcut.unregisterAll();
    }
  }

  private _createGlobalKeybindings(): void {
    globalShortcut.unregisterAll();
    const generalConfig = <GeneralConfig> this.configDatabase.getConfig(GENERAL_CONFIG);
    const keybindingsFile = this.keybindingsIOManager.getFlatKeybindingsSet(generalConfig.keybindingsName);
    const globalKeybindings = new KeybindingsMapping(KeyStroke.parseConfigString, keybindingsFile, process.platform);

    const commandsToEmitters = {
      "extraterm:global.globalMaximize": this._onMaximizeEventEmitter,
      "extraterm:global.globalHide": this._onHideWindowEventEmitter,
      "extraterm:global.globalShow": this._onShowWindowEventEmitter,
      "extraterm:global.globalToggleShowHide": this._onToggleShowHideWindowEventEmitter,
    };

    for (const command in commandsToEmitters) {
      for (const keyStroke of globalKeybindings.getKeyStrokesForCommand(command)) {
        globalShortcut.register(keyStrokeToAccelerator(keyStroke), () => {
          doLater(() => commandsToEmitters[command].fire());
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

  if (keyStroke.plainKeyLowercase in keyHumanNames) {
    parts.push(keyHumanNames[keyStroke.plainKeyLowercase]);
  } else {
    parts.push(_.capitalize(keyStroke.plainKey));
  }
  return parts.join("+");
}
