/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import 'jest';
import { keyStrokeToAccelerator } from "./GlobalKeybindings";
import { KeyStroke } from '../keybindings/KeybindingsMapping';

describe.each([
  ["Ctrl-A", "Ctrl+A"],
  ["Ctrl-Plus", "Ctrl+Plus"],
  ["Alt-Space", "Alt+Space"],
  ["Shift-PageDown", "Shift+PageDown"],
  ["Cmd-Shift-PageUp", "Cmd+Shift+PageUp"],
  ["Cmd-Shift-Plus", "Cmd+Shift+Plus"],
  ["Cmd-Minus", "Cmd+Minus"],
  ["Cmd-=", "Cmd+="],
  ["Shift-Tab", "Shift+Tab"],
  ["Backspace", "Backspace"],
  ["Delete", "Delete"],
  ["Insert", "Insert"],
  ["Return", "Return"],
  ["Up", "Up"],
  ["Down", "Down"],
  ["Escape", "Escape"],
  ["F1", "F1"],
  ])("map to Electron accelerator string", (in_: string, out: string) => {
  test(`map '${in_}' to Electron accelerator string '${out}'`, () => {
    const keyStroke = KeyStroke.parseConfigString(in_);
    expect(keyStrokeToAccelerator(keyStroke)).toBe(out);
  });
});

