/*
 * Copyright 2016-2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash-es';

import { Logger, getLogger } from "extraterm-logging";
import { MinimalKeyboardEvent as TermMinimalKeyboardEvent } from "term-api";
import { KeybindingsBinding, KeybindingsSet } from "./KeybindingsTypes.js";


export interface KeyStrokeOptions {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  plainKey: string;
};

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class TermKeybindingsMapping {

  private _log: Logger = null;

  readonly keyStrokeList: TermKeyStroke[] = [];
  #keyStrokeHashToCommandsMapping = new Map<string, KeybindingsBinding[]>();
  #commandToKeyStrokeMap = new Map<string, TermKeyStroke[]>();

  constructor(keybindingsFile: KeybindingsSet) {
    this._log = getLogger("KeybindingMapping", this);
    this.#buildIndex(keybindingsFile.bindings);
  }

  getKeyStrokesForCommand(command: string): TermKeyStroke[] {
    return this.#commandToKeyStrokeMap.get(command) || [];
  }

  /**
   * Maps a keyboard event to possible commands.
   *
   * @param ev the keyboard event
   * @return list of commands bound to this keyboard event.
   */
  mapEventToCommands(ev: TermMinimalKeyboardEvent): string[] {
    const lowerKey = eventKeyNameToConfigKeyName(ev.key).toLowerCase();
    for (const keybinding of this.keyStrokeList) {
      if (keybinding.plainKeyLowercase === lowerKey &&
          keybinding.altKey === ev.altKey &&
          keybinding.ctrlKey === ev.ctrlKey &&
          keybinding.shiftKey === ev.shiftKey &&
          keybinding.metaKey === ev.metaKey) {
        return this.#keyStrokeHashToCommandsMapping.get(keybinding.hashString()).map(binding => binding.command);
      }
    }
    return [];
  }
  // this._log.debug(`altKey: ${ev.altKey}, ctrlKey: ${ev.ctrlKey}, metaKey: ${ev.metaKey}, shiftKey: ${ev.shiftKey}, key: ${ev.key}, keyCode: ${ev.keyCode}`);

  #buildIndex(bindingsList: KeybindingsBinding[]): void {
    for (const keybinding of bindingsList) {
      const shortcutList = keybinding.keys;

      const ksList = shortcutList.map(TermKeyStroke.parseConfigString);

      for (const ks of ksList) {
        this.keyStrokeList.push(ks);
      }

      const ksHashList = ksList.map(ks => ks.hashString());

      this.#setKeyStrokesForCommand(keybinding.command, ksList);

      for (const ksHash of ksHashList) {
        let list = this.#keyStrokeHashToCommandsMapping.get(ksHash);
        if (list == null) {
          list = [];
          this.#keyStrokeHashToCommandsMapping.set(ksHash, list);
        }
        list.push(keybinding);
      }
    }
  }

  #setKeyStrokesForCommand(command: string, keyStrokes: TermKeyStroke[]): void {
    this.#commandToKeyStrokeMap.set(command, keyStrokes);
  }
}

const isDarwin = process.platform === "darwin";

// Defines a single key stroke which the user can press using one or a more keys.
export class TermKeyStroke {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly plainKey: string;
  readonly plainKeyLowercase: string;
  private _humanReadableString: string = null;
  readonly isComposing: boolean = false;

  readonly key: string;

  constructor(options: KeyStrokeOptions) {
    this.altKey = options.altKey;
    this.ctrlKey = options.ctrlKey;
    this.metaKey = options.metaKey;
    this.shiftKey = options.shiftKey;
    this.plainKey = options.plainKey;
    this.plainKeyLowercase = options.plainKey.toLowerCase();
    this.key = configKeyNameToEventKeyName(options.plainKey);
  }

  static parseConfigString(keyStrokeString: string): TermKeyStroke {
    const parts = keyStrokeString.replace(/\s/g, "").split(/-/g);
    const partSet = new Set(parts.map(part => part.length !== 1 ? part.toLowerCase() : part));
    const hasShift = partSet.has("shift");
    partSet.delete("shift");
    const hasCtrl = partSet.has("ctrl");
    partSet.delete("ctrl");
    const hasAlt = partSet.has("alt");
    partSet.delete("alt");
    const hasMeta = partSet.has("meta") || partSet.has("cmd");
    partSet.delete("meta");
    partSet.delete("cmd");

    if (partSet.size !== 1) {
      return null;
    }

    const key = partSet.values().next().value;
    const keyStroke = new TermKeyStroke({
      altKey: hasAlt,
      ctrlKey: hasCtrl,
      shiftKey: hasShift,
      metaKey: hasMeta,
      plainKey: key
    });

    return keyStroke;
  }

  formatHumanReadable(): string {
    if (this._humanReadableString != null) {
      return this._humanReadableString;
    }

    const parts: string[] = [];
    if (isDarwin) {
      if (this.ctrlKey) {
        parts.push("^");
      }
      if (this.altKey) {
        parts.push("\u2325");
      }
      if (this.shiftKey) {
        parts.push("\u21E7");
      }
      if (this.metaKey) {
        parts.push("\u2318"); // Mac style 'pretzel' symbol
      }
    } else {
      if (this.ctrlKey) {
        parts.push("Ctrl");
      }
      if (this.metaKey) {
        parts.push("\u2318"); // Mac style 'pretzel' symbol
      }
      if (this.altKey) {
        parts.push("Alt");
      }
      if (this.shiftKey) {
        parts.push("Shift");
      }
    }

    if (eventKeyToHumanMapping[this.plainKey.toLowerCase()] !== undefined) {
      parts.push(eventKeyToHumanMapping[this.plainKey.toLowerCase()]);
    } else {
      parts.push(_.capitalize(this.plainKey));
    }

    this._humanReadableString = parts.join(isDarwin ? "" : "+");
    return this._humanReadableString;
  }

  hashString(): string {
    return `${mapString(this.plainKey)}:${mapBool(this.altKey)}:${mapBool(this.ctrlKey)}:${mapBool(this.metaKey)}:${mapBool(this.shiftKey)}`;
  }
}

// Maps key names as found in our configuration files to the values used by browser keyboard events.
const configNameToEventKeyMapping = {
  "Space": " ",
  "Plus": "+",
  "Minus": "-",
  "Esc": "Escape",
  "Up": "ArrowUp",
  "Down": "ArrowDown",
  "Left": "ArrowLeft",
  "Right": "ArrowRight"
};

// Maps special key names in all lower case back to mixed case.
const lowerConfigNameToEventKeyMapping = {};
for (const key in configNameToEventKeyMapping) {
  lowerConfigNameToEventKeyMapping[key.toLowerCase()] = configNameToEventKeyMapping[key];
}

const eventKeyToHumanMapping = {
  "pageup": "Page Up",
  "pagedown": "Page Down",
  "minus": "-",
  "plus": "+"
};
for (const key in configNameToEventKeyMapping) {
  eventKeyToHumanMapping[configNameToEventKeyMapping[key].toLowerCase()] = key;
}

function mapBool(b: boolean): string {
  if (b === undefined) {
    return "?";
  }
  return b ? "T" : "F";
}

function mapString(s: string): string {
  return s === undefined ? "" : s;
}

export function configKeyNameToEventKeyName(configKeyName: string): string {
  if (lowerConfigNameToEventKeyMapping[configKeyName.toLowerCase()] !== undefined) {
    return lowerConfigNameToEventKeyMapping[configKeyName.toLowerCase()];
  } else {
    return configKeyName.length === 1 ? configKeyName : _.capitalize(configKeyName.toLowerCase());
  }
}

const eventKeyToConfigKeyMapping = new Map<string, string>();
for (const configKey in configNameToEventKeyMapping) {
  eventKeyToConfigKeyMapping.set(configNameToEventKeyMapping[configKey], configKey);
}

export function eventKeyNameToConfigKeyName(eventKeyName: string): string {
  if (eventKeyToConfigKeyMapping.has(eventKeyName)) {
    return eventKeyToConfigKeyMapping.get(eventKeyName);
  }
  return eventKeyName;
}
