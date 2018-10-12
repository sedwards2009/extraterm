/*
 * Copyright 2016-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from 'extraterm-extension-api';
import * as _ from 'lodash';

import { Logger, getLogger, log } from "extraterm-logging";
import * as SetUtils from '../../utils/SetUtils';
import { MinimalKeyboardEvent as TermMinimalKeyboardEvent } from 'term-api';

const FALLTHROUGH = "fallthrough";
const NAME = "name";

export interface MinimalKeyboardEvent extends TermMinimalKeyboardEvent {
  keyCode: number;
}

export interface KeybindingOptions {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  configKey: string;
};

// Internal data structure for pairing a key binding with a command.
export class Keybinding implements TermMinimalKeyboardEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly key: string;
  readonly configKey: string;
  readonly configKeyLowercase: string;
  private _humanReadableString: string = null;

  constructor(options: KeybindingOptions) {
    this.altKey = options.altKey;
    this.ctrlKey = options.ctrlKey;
    this.metaKey = options.metaKey;
    this.shiftKey = options.shiftKey;
    this.key = configKeyNameToEventKeyName(options.configKey);
    this.configKey = options.configKey;
    this.configKeyLowercase = options.configKey.toLowerCase();
  }

  static parseConfigString(keyBindingString: string): Keybinding {
    const parts = keyBindingString.replace(/\s/g, "").split(/-/g);
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
    const keybinding = new Keybinding({
      altKey: hasAlt,
      ctrlKey: hasCtrl,
      shiftKey: hasShift,
      metaKey: hasMeta,
      configKey: key
    });
  
    return keybinding;
  }

  equals(other: Keybinding): boolean {
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

function mapBool(b: boolean): string {
  if (b === undefined) {
    return "?";
  }
  return b ? "T" : "F";
}

function mapString(s: string): string {
  return s === undefined ? "" : s;
}

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class KeybindingsMapping {

  public keybindingsList: Keybinding[] = [];
  private _keybindingCommandMapping = new Map<Keybinding, string>();
  private _log: Logger = null;
  private _platform: string;
  private _enabled = true;

  constructor(mappingName: string, allMappingsJson: Object, platform: string) {
    this._log = getLogger("KeybindingMapping", this);
    this._platform = platform;
    this._gatherPairs(mappingName, allMappingsJson).forEach((pair) => {
      const keybinding = Keybinding.parseConfigString(pair.key);
      // pair.value
      if (keybinding !== null) {
        this._keybindingCommandMapping.set(keybinding, pair.value);
        this.keybindingsList.push(keybinding);
      } else {
        this._log.warn(`Unable to parse key binding '${pair.key}'. Skipping.`);
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  equals(other: KeybindingsMapping): boolean {
    if (other == null) {
      return false;
    }
    if (other === this) {
      return true;
    }

    if (other._platform !== this._platform) {
      return false;
    }

    const myBindings = this.keybindingsList.map(b => this._makeKey(b));
    const otherBindings = other.keybindingsList.map(b => this._makeKey(b));
    myBindings.sort();
    otherBindings.sort();

    return _.isEqual(myBindings, otherBindings);
  }

  private _makeKey(binding: Keybinding): string {
    const command = this._keybindingCommandMapping.get(binding);
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
  
  /**
   * Maps a keyboard event to a command string.
   *
   * @param ev the keyboard event
   * @return the command string or `null` if the event doesn't have a matching
   *         key binding.
   */
  mapEventToCommand(ev: MinimalKeyboardEvent): string {
    if ( ! this._enabled) {
      return null;
    }


    let key = "";
    if (ev.key.length === 1 && ev.key.charCodeAt(0) <= 31) {
      // Chrome on Windows sends us control codes directly in ev.key.
      // Turn them back into normal characters.
      if (ev.keyCode === 13) {
        key = "Enter";
      } else {
        key = String.fromCharCode(ev.keyCode | 0x40);
      }
    } else {
      if (ev.key.charCodeAt(0) === 160) { // nbsp to space on the Mac
        key = " ";
      } else {        
        key = ev.key;
      }
    }

    for (let keybinding of this.keybindingsList) {
      // Note: We don't compare Shift. It is assumed to be automatically handled by the
      // case of the key sent, except in the case where a special key is used.
      const lowerKey = eventKeyNameToConfigKeyName(key).toLowerCase();
      if (keybinding.configKeyLowercase === lowerKey &&
          keybinding.altKey === ev.altKey &&
          keybinding.ctrlKey === ev.ctrlKey &&
          keybinding.shiftKey === ev.shiftKey &&
          keybinding.metaKey === ev.metaKey) {
        return this._keybindingCommandMapping.get(keybinding);
      }
    }
    return null;
  }
  // this._log.debug(`altKey: ${ev.altKey}, ctrlKey: ${ev.ctrlKey}, metaKey: ${ev.metaKey}, shiftKey: ${ev.shiftKey}, key: ${ev.key}, keyCode: ${ev.keyCode}`);

  /**
   * Maps a command name to a readable key binding name.
   * 
   * @param  command the command to map
   * @return the matching key binding string if there is one preset, otherwise
   *         null
   */
  mapCommandToHumanKeybinding(command: string): string {
    for (let keybinding of this.keybindingsList) {
      if (this._keybindingCommandMapping.get(keybinding) === command) {
        return keybinding.formatHumanReadable();
      }
    }
    return null;
  }

//   mapCommandToKeybindings(command: string): string[] {
//     const result: string[] = [];
//     for (let keyBinding of this.keyBindings) {
//       if (keyBinding.command === command) {
//         result.push(keyBinding.shortcut);
//       }
//     }
//     return result;
//   }
}


/**
 * Container for mapping context names to KeybindingMapper objects.
 */
export class KeybindingsContexts {
  private _log: Logger = null;
  private _contexts = new Map<string, KeybindingsMapping>();
  public contextNames: string[] = [];
  private _enabled = true;

  constructor(obj: object, platform: string) {
    this._log = getLogger("KeybindingContexts", this);
    for (let key in obj) {
      if (key !== NAME) {
        const mapper = new KeybindingsMapping(key, obj, platform);
        this.contextNames.push(key);
        this._contexts.set(key, mapper);
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  equals(other: KeybindingsContexts): boolean {
    if (other == null) {
      return false;
    }
    if (this === other) {
      return true;
    }

    if ( ! SetUtils.equals(new Set(this._contexts.keys()), new Set(other._contexts.keys()))) {
      return false;
    }

    const contexts = this._contexts;
    const otherContexts = other._contexts;

    for (const key of contexts.keys()) {
      const value1 = contexts.get(key);
      const value2 = otherContexts.get(key);
      if (value1 !== value2 && ! value1.equals(value2)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Looks up the KeybindingMapping for a context by name.
   *
   * @parmam contextName the string name of the context to look up
   * @return the `KeybindingMapping` object for the context or `null` if the
   *         context is unknown
   */
  context(contextName: string): KeybindingsMapping {
    const mapping = this._contexts.get(contextName) || null;
    if (mapping != null) {
      mapping.setEnabled(this._enabled);
    }
    return mapping;
  }
}

/**
 * Loads key bindings in from a JSON style object.
 *
 * @param obj the JSON style object with keys being context names and values
 *            being objects mapping key binding strings to command strings
 * @return the object which maps context names to `KeybindingMapping` objects
 */
export function loadKeybindingsFromObject(obj: object, platform: string): KeybindingsContexts {
  return new KeybindingsContexts(obj, platform);
}

export interface KeybindingsManager {
  /**
   * Gets the KeybindingContexts object contain within.
   *
   * @return the KeybindingContexts object or Null if one is not available.
   */
  getKeybindingsContexts(): KeybindingsContexts;
  
  setKeybindingsContexts(newKeybindingsContexts: KeybindingsContexts): void;

  /**
   * Register a listener to hear when the key bindings change.
   *
   */
  onChange: Event<void>;

  setEnabled(on: boolean): void;
}

export interface AcceptsKeybindingsManager {
  setKeybindingsManager(newKeybindingsManager: KeybindingsManager): void;
}

export function isAcceptsKeybindingsManager(instance: any): instance is AcceptsKeybindingsManager {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<AcceptsKeybindingsManager> instance).setKeybindingsManager !== undefined;
}

export function injectKeybindingsManager(instance: any, keybindingsManager: KeybindingsManager): void {
  if (isAcceptsKeybindingsManager(instance)) {
    instance.setKeybindingsManager(keybindingsManager);
  }
}
