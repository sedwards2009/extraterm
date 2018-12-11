/*
 * Copyright 2016-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import { Logger, getLogger, log } from "extraterm-logging";

const FALLTHROUGH = "fallthrough";


export interface KeyStrokeOptions {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  configKey: string;
};


// Defines a single key stroke which the user can press using one or a more keys.
export class KeyStroke {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly configKey: string;
  readonly configKeyLowercase: string;
  private _humanReadableString: string = null;
  readonly isComposing: boolean = false;
  
  constructor(options: KeyStrokeOptions) {
    this.altKey = options.altKey;
    this.ctrlKey = options.ctrlKey;
    this.metaKey = options.metaKey;
    this.shiftKey = options.shiftKey;
    this.configKey = options.configKey;
    this.configKeyLowercase = options.configKey.toLowerCase();
  }

  static parseConfigString(keyStrokeString: string): KeyStroke {
    return parseConfigKeyStrokeString((options: KeyStrokeOptions) => new KeyStroke(options), keyStrokeString);
  }

  equals(other: KeyStroke): boolean {
    if (other == null) {
      return false;
    }
    return this.altKey === other.altKey &&
      this.ctrlKey === other.ctrlKey &&
      this.metaKey === other.metaKey &&
      this.shiftKey === other.shiftKey &&
      this.configKeyLowercase === other.configKeyLowercase;
  }

  formatHumanReadable(): string {
    if (this._humanReadableString != null) {
      return this._humanReadableString;
    }

    const parts: string[] = [];
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
  
    if (eventKeyToHumanMapping[this.configKey.toLowerCase()] !== undefined) {
      parts.push(eventKeyToHumanMapping[this.configKey.toLowerCase()]);
    } else {
      parts.push(_.capitalize(this.configKey));
    }
  
    this._humanReadableString = parts.join("+");
    return this._humanReadableString;
  }
    
  hashString(): string {
    return `${mapString(this.configKey)}:${mapBool(this.altKey)}:${mapBool(this.ctrlKey)}:${mapBool(this.metaKey)}:${mapBool(this.shiftKey)}`;
  }
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

export function parseConfigKeyStrokeString<KS extends KeyStroke>(construct: (options: KeyStrokeOptions) => KS, keyStrokeString: string): KS {
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
  const keyStroke = construct({
    altKey: hasAlt,
    ctrlKey: hasCtrl,
    shiftKey: hasShift,
    metaKey: hasMeta,
    configKey: key
  });

  return keyStroke;
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
};
for (const key in configNameToEventKeyMapping) {
  eventKeyToHumanMapping[configNameToEventKeyMapping[key].toLowerCase()] = key;
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

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class KeybindingsMapping<KS extends KeyStroke=KeyStroke> {

  readonly keyStrokeList: KS[] = [];
  protected _keyStrokeToCommandMapping = new Map<KS, string>();
  private _log: Logger = null;
  private _platform: string;
  private _enabled = true;

  // FIXME remove this and the param below
  private _parseConfigKeyStrokeString: (config: string) => KS = null;

  constructor(parseConfigString: (config: string) => KS, mappingName: string, allMappingsJson: Object, platform: string) {
    this._log = getLogger("KeybindingMapping", this);
    this._parseConfigKeyStrokeString = parseConfigString;
    this._platform = platform;
    this._gatherPairs(mappingName, allMappingsJson).forEach((pair) => {
      const keybinding = this._parseConfigKeyStrokeString(pair.key);
      if (keybinding !== null) {
        this._keyStrokeToCommandMapping.set(keybinding, pair.value);
        this.keyStrokeList.push(keybinding);
      } else {
        this._log.warn(`Unable to parse key binding '${pair.key}'. Skipping.`);
      }
    });
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  equals(other:  KeybindingsMapping<KS>): boolean {
    if (other == null) {
      return false;
    }
    if (other === this) {
      return true;
    }

    if (other._platform !== this._platform) {
      return false;
    }

    const myBindings = this.keyStrokeList.map(b => this._makeKey(b));
    const otherBindings = other.keyStrokeList.map(b => this._makeKey(b));
    myBindings.sort();
    otherBindings.sort();

    return _.isEqual(myBindings, otherBindings);
  }

  private _makeKey(binding: KS): string {
    const command = this._keyStrokeToCommandMapping.get(binding);
    return mapString(command) + ":" + binding.hashString();
  }

  private _gatherPairs(name: string, allMappings: Object): { key: string, value: string}[] {
    const mapping = allMappings[name];
    if (mapping === undefined) {
      this._log.warn(`Unable to find mapping with name '${name}'.`);
      return [];
    }
    
    let result = [];
    if (mapping[FALLTHROUGH] !== undefined) {
      result = this._gatherPairs(mapping[FALLTHROUGH], allMappings);
    }
    for (let key in mapping) {
      if (key !== FALLTHROUGH) {
        result.push( { key: key, value: mapping[key] } );
      }
    }
    return result;
  }
}
