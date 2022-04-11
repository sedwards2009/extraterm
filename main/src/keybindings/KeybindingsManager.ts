/*
 * Copyright 2016-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, getLogger } from "extraterm-logging";
import { MinimalKeyboardEvent as TermMinimalKeyboardEvent } from "term-api";
import { KeyStroke, KeybindingsMapping, KeyStrokeOptions, parseConfigKeyStrokeString, configKeyNameToEventKeyName,
  eventKeyNameToConfigKeyName } from "./KeybindingsMapping.js";
import { KeybindingsSet } from "./KeybindingsTypes.js";

export class TermKeybindingsMapping extends KeybindingsMapping<TermKeyStroke> {

  private _term_log: Logger = null;

  constructor(keybindingsFile: KeybindingsSet, platform: string) {
    super(TermKeyStroke.parseConfigString, keybindingsFile, platform);
    this._term_log = getLogger("TermKeybindingsMapping", this);
  }

  /**
   * Maps a keyboard event to possible commands.
   *
   * @param ev the keyboard event
   * @return list of commands bound to this keyboard event.
   */
  mapEventToCommands(ev: MinimalKeyboardEvent): string[] {
    if ( ! this.isEnabled()) {
      return [];
    }

    const lowerKey = eventKeyNameToConfigKeyName(ev.key).toLowerCase();
    for (const keybinding of this.keyStrokeList) {
      if (keybinding.plainKeyLowercase === lowerKey &&
          keybinding.altKey === ev.altKey &&
          keybinding.ctrlKey === ev.ctrlKey &&
          keybinding.shiftKey === ev.shiftKey &&
          keybinding.metaKey === ev.metaKey) {
        return this._keyStrokeHashToCommandsMapping.get(keybinding.hashString()).map(binding => binding.command);
      }
    }
    return [];
  }
  // this._log.debug(`altKey: ${ev.altKey}, ctrlKey: ${ev.ctrlKey}, metaKey: ${ev.metaKey}, shiftKey: ${ev.shiftKey}, key: ${ev.key}, keyCode: ${ev.keyCode}`);

  mapCommandToReadableKeyStrokes(command: string): string[] {
    const keyStrokes = this.getKeyStrokesForCommand(command);
    if (keyStrokes == null) {
      return [];
    }
    return keyStrokes.map(ks => ks.formatHumanReadable());
  }
}

// TODO: eliminate this.
export type MinimalKeyboardEvent = TermMinimalKeyboardEvent;

// Internal data structure for pairing a key binding with a command.
export class TermKeyStroke extends KeyStroke implements TermMinimalKeyboardEvent {

  readonly key: string;

  constructor(options: KeyStrokeOptions) {
    super(options);
    this.key = configKeyNameToEventKeyName(options.plainKey);
  }

  static parseConfigString(keybindingString: string): TermKeyStroke {
    return parseConfigKeyStrokeString((options: KeyStrokeOptions) => new TermKeyStroke(options), keybindingString);
  }
}

/**
 * Loads key bindings in from a JSON style object.
 *
 * @param obj the JSON style object with keys being context names and values
 *            being objects mapping key binding strings to command strings
 * @return the object which maps context names to `KeybindingMapping` objects
 */
// export function loadKeybindingsFromObject(obj: KeybindingsSet, platform: string): TermKeybindingsMapping {
//   return new TermKeybindingsMapping(obj, platform);
// }

// export interface KeybindingsManager {
//   /**
//    * Gets the KeybindingContexts object contain within.
//    *
//    * @return the KeybindingContexts object or Null if one is not available.
//    */
//   getKeybindingsMapping(): TermKeybindingsMapping;

//   setKeybindingsMapping(newKeybindingsContexts: TermKeybindingsMapping): void;

//   /**
//    * Register a listener to hear when the key bindings change.
//    *
//    */
//   onChange: Event<void>;

//   setEnabled(on: boolean): void;
// }
