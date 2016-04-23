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

// Internal data structure for pairing a shortcut with a command.
interface Shortcut {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;  
  key: string;
  
  command: string;
}

// Maps key names to the values used by browser keyboard events.
const configNameToEventKeyMapping = {
  "Space": " ",
  "Plus": "+",
  "PageUp": "PageUp",
  "PageDown": "PageDown",
  "Esc": "Escape",
  "ArrowUp": "ArrowUp",
  "ArrowDown": "ArrowDown",
  "ArrowLeftUp": "ArrowLeft",
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
  "ArrowLeft": "Arrow Left",
  "ArrowRight": "Arrow Right",
  "ArrowUp": "Arrow Up",
  "ArrowDown": "Arrow Down",
});

/**
 * Mapping from keyboard events to command strings, and command strings to
 * shortcut names.
 */
export class ShortcutMapping {
  
  private _shortcutList: Shortcut[] = [];
  
  private _log = new Logger("ShortcutMapping");
  
  constructor(mappingJson: Object) {
    for (let key in mappingJson) {
      const parsedShortcut = parseShortcut(key, mappingJson[key]);
      if (parsedShortcut !== null) {
        this._shortcutList.push(parsedShortcut);
      } else {
        this._log.warn("Unable to parse shortcut '" + key + "'. Skipping.");
      }
    }
  }
  
  /**
   * Maps a keyboard event to a command string.
   *
   * @param ev the keyboard event
   * @return the command string or `null` if the event doesn't have a matching
   *         shortcut.
   */
  mapEventToCommand(ev: MinimalKeyboardEvent): string {
    const key = ev.key.toLowerCase();
    for (let shortcut of this._shortcutList) {
      if (shortcut.key === ev.key &&
          shortcut.altKey === ev.altKey &&
          shortcut.ctrlKey === ev.ctrlKey &&
          shortcut.shiftKey === ev.shiftKey &&
          shortcut.metaKey === ev.metaKey) {
        return shortcut.command;
      }
    }
    return null;
  }
  
  /**
   * Maps a command name to a readable shortcut name.
   * 
   * @param  command the command to map
   * @return the matching shortcut string if there is one preset, otherwise
   *         null
   */
  mapCommandToShortcut(command: string): string {
    for (let shortcut of this._shortcutList) {
      if (shortcut.command === command) {
        return formatShortcut(shortcut);
      }
    }
    return null;
  }
}

function parseShortcut(shortcutString: string, command: string): Shortcut {
  const parts = shortcutString.toLowerCase().replace(/\s/g,"").split(/\+/g);
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
    key = key.length === 1 ? key.toLowerCase() : _.capitalize(key.toLowerCase());
  }
  
  const shortcut: Shortcut = {
    altKey: hasAlt,
    ctrlKey: hasCtrl,
    shiftKey: hasShift,
    metaKey: hasMeta,
    key: key,
    command: command
  };
  return shortcut;
}

function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey) {
    parts.push("Ctrl");
  }
  if (shortcut.metaKey) {
    parts.push("Cmd");
  }
  if (shortcut.altKey) {
    parts.push("Alt");
  }
  if (shortcut.shiftKey) {
    parts.push("Shift");
  }
  
  if (eventKeyToHumanMapping[shortcut.key] !== undefined) {
    parts.push(eventKeyToHumanMapping[shortcut.key]);
  } else {
    parts.push(_.capitalize(shortcut.key));
  }
  
  return parts.join("+");
}

/**
 * Container for mapping context names ot ShortcutMapper objects.
 */
export class ShortcutContexts {
  
  private _contexts = new Map<string, ShortcutMapping>();
  
  constructor(obj: Object) {
    for (let key in obj) {
      const mapper = new ShortcutMapping(obj[key]);
      this._contexts.set(key, mapper);
    }
  }
  
  /**
   * Looks up the ShortcutMapping for a context by name.
   *
   * @parmam contextName the string name of the context to look up
   * @return the `ShortcutMapping` object for the context or `null` if the
   *         context is unknown
   */
  context(contextName: string): ShortcutMapping {
    return this._contexts.get(contextName) || null;
  }
}

/**
 * Loads shortcuts in from a JSON style object.
 *
 * @param obj the JSON style object with keys being context names and values
 *            being objects mapping shortcut strings to command strings
 * @return the object which maps context names to `ShortcutMapping` objects
 */
export function loadShortcutsFromObject(obj: Object): ShortcutContexts {
  return new ShortcutContexts(obj);
}
