/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Logger = require('./logger');
import _ = require('lodash');

const FALLTHROUGH = "fallthrough";
const NAME = "name";

export interface MinimalKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;  
  key: string;
  keyCode: number;
  keyIdentifier: string;
}

// Internal data structure for pairing a key binding with a command.
interface KeyBinding {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;  
  key: string;
  
  command: string;
  shortcut: string;
  normalizedShortcut: string;
}

// Maps key names to the values used by browser keyboard events.
const configNameToEventKeyMapping = {
  "Space": " ",
  "Plus": "+",
  "Minus": "-",
  "PageUp": "PageUp",
  "PageDown": "PageDown",
  "Esc": "Escape",
  "Up": "ArrowUp",
  "Down": "ArrowDown",
  "Left": "ArrowLeft",
  "Right": "ArrowRight",
  "ArrowUp": "ArrowUp",
  "ArrowDown": "ArrowDown",
  "ArrowLeft": "ArrowLeft",
  "ArrowRight": "ArrowRight",
  "NumLock": "NumLock",
  "ScrollLock": "ScrollLock",
};

// Maps special key names in all lower case back to mixed case.
const lowerConfigNameToEventKeyMapping = {};
for (const key in configNameToEventKeyMapping) {
  lowerConfigNameToEventKeyMapping[key.toLowerCase()] = configNameToEventKeyMapping[key];
}

const eventKeyToHumanMapping = _.merge(configNameToEventKeyMapping, {
  "PageUp": "Page Up",
  "PageDown": "Page Down",
  "ArrowLeft": "Left",
  "ArrowRight": "Right",
  "ArrowUp": "Up",
  "ArrowDown": "Down",
  " ": "Space",
});

const eventKeyToCodeMirrorMapping = {
  "ArrowLeft": "Left",
  "ArrowRight": "Right",
  "ArrowUp": "Up",
  "ArrowDown": "Down",
  "Escape": "Esc",
};

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class KeyBindingMapping {
  
  public keyBindings: KeyBinding[] = [];
  
  private _log = new Logger("KeyBindingMapping");
  
  private _platform: string;
  
  constructor(mappingName: string, allMappingsJson: Object, platform: string) {
    this._platform = platform;
    this._gatherPairs(mappingName, allMappingsJson).forEach( (pair) => {
      const parsedKeyBinding = parseKeyBinding(pair.key, pair.value);
      if (parsedKeyBinding !== null) {
        this.keyBindings.push(parsedKeyBinding);
      } else {
        this._log.warn(`Unable to parse key binding '${pair.key}'. Skipping.`);
      }
    });
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
    let key;
    if (ev.key.length === 1 && ev.key.charCodeAt(0) <= 31) {
      // Chrome on Windows sends us control codes directly in ev.key.
      // Turn them back into normal characters.
      if (ev.keyCode === 13) {
        key = "Enter";
      } else {
        key = String.fromCharCode(ev.keyCode);
      }
    } else {
      if (ev.key.charCodeAt(0) === 160) { // nbsp to space on the Mac
        key = " ";
      } else {
        
        key = ev.key; // use ev.key until proven otherwise.
        if (this._platform === "linux") {
          // FIXME The key handling on Linux is broken a bit in Chrome 52. This code is a work around.
          //       It is mostly needed to make Dvorak work ok.
          if (ev.keyIdentifier.startsWith("U+")) {
            const keyValue = Number.parseInt(ev.keyIdentifier.slice(2), 16);
            const keyStr = String.fromCodePoint(keyValue);
            if ((keyStr >= 'a' && keyStr <= 'z') || (keyStr >= 'A' && keyStr <= 'Z')) {
              if ( ! ev.shiftKey) {
                key = keyStr.toLowerCase();
              } else {
                key = keyStr;
              }
            }
          }
        }
      }
    }

    for (let keyBinding of this.keyBindings) {
      // Note: We don't compare Shift. It is assumed to be automatically handled by the
      // case of the key sent, except in the case where a special key is used.
      if (keyBinding.key === key &&
          keyBinding.altKey === ev.altKey &&
          keyBinding.ctrlKey === ev.ctrlKey &&
          ((key.length === 1 && key !== " ") || keyBinding.shiftKey === ev.shiftKey) &&
          keyBinding.metaKey === ev.metaKey) {
        return keyBinding.command;
      }
    }
    return null;
  }

  /**
   * Maps a command name to a readable key binding name.
   * 
   * @param  command the command to map
   * @return the matching key binding string if there is one preset, otherwise
   *         null
   */
  mapCommandToKeyBinding(command: string): string {
    for (let keyBinding of this.keyBindings) {
      if (keyBinding.command === command) {
        return keyBinding.shortcut;
      }
    }
    return null;
  }
}

function parseKeyBinding(keyBindingString: string, command: string): KeyBinding {
  const parts = keyBindingString.replace(/\s/g,"").split(/-/g);
  const partSet = new Set( parts.map( part => part.length !== 1 ? part.toLowerCase() : part) );
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
  
  let key = partSet.values().next().value;
  if (lowerConfigNameToEventKeyMapping[key.toLowerCase()] !== undefined) {
    key = lowerConfigNameToEventKeyMapping[key.toLowerCase()];
  } else {
    key = key.length === 1 ? key : _.capitalize(key.toLowerCase());
  }
  
  const keyBinding: KeyBinding = {
    altKey: hasAlt,
    ctrlKey: hasCtrl,
    shiftKey: hasShift,
    metaKey: hasMeta,
    key: key,
    command: command,
    shortcut: "",
    normalizedShortcut: ""
  };
  keyBinding.normalizedShortcut = formatNormalizedKeyBinding(keyBinding);
  keyBinding.shortcut = formatKeyBinding(keyBinding);
  return keyBinding;
}

function formatKeyBinding(keyBinding: KeyBinding): string {
  const parts: string[] = [];
  if (keyBinding.ctrlKey) {
    parts.push("Ctrl");
  }
  if (keyBinding.metaKey) {
    parts.push("\u2318"); // Mac style 'pretzel' symbol
  }
  if (keyBinding.altKey) {
    parts.push("Alt");
  }
  if (keyBinding.shiftKey) {
    parts.push("Shift");
  }
  
  if (eventKeyToHumanMapping[keyBinding.key] !== undefined) {
    parts.push(eventKeyToHumanMapping[keyBinding.key]);
  } else {
    parts.push(_.capitalize(keyBinding.key));
  }
  
  return parts.join("+");
}

/**
 * Creates a formatted string name of the key binding the same way CodeMirror does internally.
 */
function formatNormalizedKeyBinding(keyBinding: KeyBinding): string {
  const parts: string[] = [];
  if (keyBinding.shiftKey) {
    parts.push("Shift");
  }
  if (keyBinding.metaKey) {
    parts.push("Cmd");
  }
  if (keyBinding.ctrlKey) {
    parts.push("Ctrl");
  }
  if (keyBinding.altKey) {
    parts.push("Alt");
  }
  
  if (eventKeyToCodeMirrorMapping[keyBinding.key] !== undefined) {
    parts.push(eventKeyToCodeMirrorMapping[keyBinding.key]);
  } else {
    parts.push(_.capitalize(keyBinding.key));
  }
  
  return parts.join("-");
}

/**
 * Container for mapping context names ot KeyBindingMapper objects.
 */
export class KeyBindingContexts {
  
  private _log = new Logger("KeyBindingContexts");
  
  private _contexts = new Map<string, KeyBindingMapping>();
  
  public contextNames = [];
  
  constructor(obj: Object, platform: string) {
    for (let key in obj) {
      if (key !== NAME) {
        const mapper = new KeyBindingMapping(key, obj, platform);
        this.contextNames.push(key);
        this._contexts.set(key, mapper);
      }
    }
  }
  
  /**
   * Looks up the KeyBindingMapping for a context by name.
   *
   * @parmam contextName the string name of the context to look up
   * @return the `KeyBindingMapping` object for the context or `null` if the
   *         context is unknown
   */
  context(contextName: string): KeyBindingMapping {
    return this._contexts.get(contextName) || null;
  }
}

/**
 * Loads key bindings in from a JSON style object.
 *
 * @param obj the JSON style object with keys being context names and values
 *            being objects mapping key binding strings to command strings
 * @return the object which maps context names to `KeyBindingMapping` objects
 */
export function loadKeyBindingsFromObject(obj: Object, platform: string): KeyBindingContexts {
  return new KeyBindingContexts(obj, platform);
}

export interface KeyBindingManager {
  /**
   * Gets the KeyBindingContexts object contain within.
   *
   * @return the KeyBindingContexts object or Null if one is not available.
   */
  getKeyBindingContexts(): KeyBindingContexts;
  
  setKeyBindingContexts(newKeyBindingContexts: KeyBindingContexts): void;
  
  /**
   * Register a listener to hear when the key bindings change.
   *
   * @param key an opaque object which is used to identify this registration.
   * @param onChange the function to call when the config changes.
   */
  registerChangeListener(key: any, onChange: () => void): void;
  
  /**
   * Unregister a listener.
   *
   * @param key the same opaque object which was used during registerChangeListener().
   */
  unregisterChangeListener(key: any): void;
}

export interface AcceptsKeyBindingManager {
  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void;
}

export function isAcceptsKeyBindingManager(instance: any): instance is AcceptsKeyBindingManager {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<AcceptsKeyBindingManager> instance).setKeyBindingManager !== undefined;
}

export function injectKeyBindingManager(instance: any, keyBindingManager: KeyBindingManager): void {
  if (isAcceptsKeyBindingManager(instance)) {
    instance.setKeyBindingManager(keyBindingManager);
  }
}
