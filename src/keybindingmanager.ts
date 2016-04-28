/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Logger = require('./logger');
import _ = require('lodash');

export interface MinimalKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;  
  key: string;
}

// Internal data structure for pairing a key binding with a command.
interface KeyBinding {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;  
  key: string;
  
  command: string;
  shortcutCode: string;
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
});

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class KeyBindingMapping {
  
  public keyBindings: KeyBinding[] = [];
  
  private _log = new Logger("KeyBindingMapping");
  
  constructor(mappingJson: Object) {
    for (let key in mappingJson) {
      const parsedKeyBinding = parseKeyBinding(key, mappingJson[key]);
      if (parsedKeyBinding !== null) {
        this.keyBindings.push(parsedKeyBinding);
      } else {
        this._log.warn("Unable to parse key binding '" + key + "'. Skipping.");
      }
    }
  }
  
  /**
   * Maps a keyboard event to a command string.
   *
   * @param ev the keyboard event
   * @return the command string or `null` if the event doesn't have a matching
   *         key binding.
   */
  mapEventToCommand(ev: MinimalKeyboardEvent): string {
    const key = ev.key.toLowerCase();
    for (let keyBinding of this.keyBindings) {
      if (keyBinding.key === ev.key &&
          keyBinding.altKey === ev.altKey &&
          keyBinding.ctrlKey === ev.ctrlKey &&
          keyBinding.shiftKey === ev.shiftKey &&
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
        return formatKeyBinding(keyBinding);
      }
    }
    return null;
  }
}

function parseKeyBinding(keyBindingString: string, command: string): KeyBinding {
  const parts = keyBindingString.toLowerCase().replace(/\s/g,"").split(/-/g);
  const partSet = new Set(parts);
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
    key = key.length === 1 ? key.toUpperCase() : _.capitalize(key.toLowerCase());
  }
  
  const keyBinding: KeyBinding = {
    altKey: hasAlt,
    ctrlKey: hasCtrl,
    shiftKey: hasShift,
    metaKey: hasMeta,
    key: key,
    command: command,
    shortcutCode: keyBindingString
  };
  return keyBinding;
}

function formatKeyBinding(keyBinding: KeyBinding): string {
  const parts: string[] = [];
  if (keyBinding.ctrlKey) {
    parts.push("Ctrl");
  }
  if (keyBinding.metaKey) {
    parts.push("Cmd");
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
 * Container for mapping context names ot KeyBindingMapper objects.
 */
export class KeyBindingContexts {
  
  private _contexts = new Map<string, KeyBindingMapping>();
  
  constructor(obj: Object) {
    for (let key in obj) {
      const mapper = new KeyBindingMapping(obj[key]);
      this._contexts.set(key, mapper);
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
export function loadKeyBindingsFromObject(obj: Object): KeyBindingContexts {
  return new KeyBindingContexts(obj);
}
