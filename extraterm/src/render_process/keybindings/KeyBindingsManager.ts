/*
 * Copyright 2016-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from 'extraterm-extension-api';

import { Logger, getLogger, log } from "extraterm-logging";
import { KeyStroke, KeybindingsMapping, KeyStrokeOptions, parseConfigKeyStrokeString, configKeyNameToEventKeyName, eventKeyNameToConfigKeyName } from "../../keybindings/KeybindingsMapping";
import * as SetUtils from '../../utils/SetUtils';
import { MinimalKeyboardEvent as TermMinimalKeyboardEvent } from 'term-api';

const NAME = "name";

export class TermKeybindingsMapping extends KeybindingsMapping<TermKeyStroke> {
  constructor(mappingName: string, allMappingsJson: Object, platform: string) {
    super(TermKeyStroke.parseConfigString, mappingName, allMappingsJson, platform);
  }

  /**
   * Maps a keyboard event to a command string.
   *
   * @param ev the keyboard event
   * @return the command string or `null` if the event doesn't have a matching
   *         key binding.
   */
  mapEventToCommand(ev: MinimalKeyboardEvent): string {
    if ( ! this.isEnabled()) {
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

    for (let keybinding of this.keyStrokeList) {
      // Note: We don't compare Shift. It is assumed to be automatically handled by the
      // case of the key sent, except in the case where a special key is used.
      const lowerKey = eventKeyNameToConfigKeyName(key).toLowerCase();
      if (keybinding.configKeyLowercase === lowerKey &&
          keybinding.altKey === ev.altKey &&
          keybinding.ctrlKey === ev.ctrlKey &&
          keybinding.shiftKey === ev.shiftKey &&
          keybinding.metaKey === ev.metaKey) {
        return this._keyStrokeToCommandMapping.get(keybinding);
      }
    }
    return null;
  }
  // this._log.debug(`altKey: ${ev.altKey}, ctrlKey: ${ev.ctrlKey}, metaKey: ${ev.metaKey}, shiftKey: ${ev.shiftKey}, key: ${ev.key}, keyCode: ${ev.keyCode}`);

  /**
   * Maps a command name to a readable key binding name.
   * 
   * @param  command the command to map
   * @return the matching key stroke string if there is one preset, otherwise
   *         null
   */
  mapCommandToReadableKeyStroke(command: string): string {
    for (let keybinding of this.keyStrokeList) {
      if (this._keyStrokeToCommandMapping.get(keybinding) === command) {
        return keybinding.formatHumanReadable();
      }
    }
    return null;
  }
}


export interface MinimalKeyboardEvent extends TermMinimalKeyboardEvent {
  keyCode: number;
}

// Internal data structure for pairing a key binding with a command.
export class TermKeyStroke extends KeyStroke implements TermMinimalKeyboardEvent {

  readonly key: string;

  constructor(options: KeyStrokeOptions) {
    super(options);
    this.key = configKeyNameToEventKeyName(options.configKey);
  }

  static parseConfigString(keybindingString: string): TermKeyStroke {
    return parseConfigKeyStrokeString((options: KeyStrokeOptions) => new TermKeyStroke(options), keybindingString);
  }
}


/**
 * Container for mapping context names to KeybindingMapper objects.
 */
export class KeybindingsContexts {
  private _log: Logger = null;
  private _contexts = new Map<string, TermKeybindingsMapping>();
  public contextNames: string[] = [];
  private _enabled = true;

  constructor(obj: object, platform: string) {
    this._log = getLogger("KeybindingContexts", this);
    for (let key in obj) {
      if (key !== NAME) {
        const mapper = new TermKeybindingsMapping(key, obj, platform);
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
  context(contextName: string): TermKeybindingsMapping {
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
