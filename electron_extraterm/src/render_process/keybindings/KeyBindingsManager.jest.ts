/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";

import * as KeybindingsManager from './KeyBindingsManager';
import { eventKeyNameToConfigKeyName } from '../../keybindings/KeybindingsMapping';
import { KeybindingsSet } from "../../keybindings/KeybindingsTypes";


const keyBindingsMap: KeybindingsSet = {
  extends: "pc-style",
  bindings: [
    {
      command: "open",
      keys: ["Ctrl-o"]
    },
    {
      command: "togglemode",
      keys: ["Ctrl-Space"]
    },
    {
      command: "zoom",
      keys: ["Ctrl-Plus"]
    },
    {
      command: "all",
      keys: ["Alt-Shift-Cmd-A"]
    },
    {
      command: "makespace",
      keys: ["space"]
    },
    {
      command: "smeg",
      keys: ["alt - shift - S"]
    },
    {
      command: "closewindow",
      keys: ["W-ctrl-shift"]
    },
    {
      command: "sleep",
      keys: ["shift-shift-shift-Z"]
    },
    {
      command: "pageup",
      keys: ["PageUp"]
    },
    {
      command: "gohome",
      keys: ["home"]
    },
    {
      command: "dedent",
      keys: ["Alt-Tab"]
    },
    {
      command: "otherpane",
      keys: ["Ctrl-Tab"]
    },
    {
      command: "finish",
      keys: ["End"]
    },
    {
      command: "up",
      keys: ["Up"]
    },
    {
      command: "down",
      keys: ["Down"]
    },
    {
      command: "rename",
      keys: ["F2"]
    },
    {
      command: "select-left",
      keys: ["Alt-Left"]
    },
    {
      command: "break",
      keys: ["Ctrl-c"]
    },
    {
      command: "bigbreak",
      keys: ["Ctrl-Shift-C"]
    },
    {
      command: "moveTabRight",
      keys: ["Ctrl-Alt-."]
    }
  ]
};

test("context", () => {
  const editorKeybindings = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");

  expect(editorKeybindings).not.toBe(null);
  expect(editorKeybindings).not.toBe(undefined);
});

function keyCode(key: string, ctrl=true): number {
  if (key.length !== 1) {
    return 0;
  } else {
    return ctrl ? key.charCodeAt(0) & ~0x0040 : key.charCodeAt(0);
  }
}

describe.each([
  [" ", "Space"],
  ["ArrowUp", "Up"],
])("", (input: string, output: string) => {

  test(`KeyNameToConfigKeyName("${input}")`, () => {
    expect(eventKeyNameToConfigKeyName(input)).toBe(output);
  });
});

describe.each([
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "o", keyCode: keyCode("o") }, "open"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ") }, "togglemode"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "+", keyCode: keyCode("+") }, "zoom"],
  [{ isComposing: false, altKey: true, ctrlKey: false, metaKey: true, shiftKey: true, key: "A", keyCode: keyCode("A",false) }, "all"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ",false) }, "makespace"],
  [{ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, key: "S", keyCode: keyCode("S",false) }, "smeg"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "W", keyCode: keyCode("W") }, "closewindow"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: true, key: "Z", keyCode: keyCode("Z",false) }, "sleep"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "PageUp", keyCode: keyCode("PageUp",false) }, "pageup"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }, "gohome"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }, "gohome"],
  [{ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "Tab", keyCode: keyCode("Tab",false) }, "dedent"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "End", keyCode: keyCode("End",false) }, "finish"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowUp", keyCode: keyCode("ArrowUp",false) }, "up"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowDown", keyCode: keyCode("ArrowDown",false) }, "down"],
  [{ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "F2", keyCode: keyCode("F2",false) }, "rename"],
  [{ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowLeft", keyCode: keyCode("ArrowLeft",false) }, "select-left"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "Tab", keyCode: 9 }, "otherpane"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "c", keyCode: 67 }, "break"],
  [{ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "C", keyCode: 67 }, "bigbreak"],
  [{ isComposing: false, altKey: true, ctrlKey: true, metaKey: false, shiftKey: false, key: ".", keyCode: 190 }, "moveTabRight"],
])("", (input, output: string) => {
  test(`mapEventToCommand() -> ${output}"`, () => {
    const editorKeybindings = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
    expect(editorKeybindings.mapEventToCommands(input)[0]).toEqual(output);
  });
});

if (process.platform === "darwin") {
  describe.each([
    ["open", "^O"],
    ["smeg", "\u2325\u21E7S"],
    ["sleep", "\u21E7Z"],
    ["pageup", "Page Up"],
    ["gohome", "Home"],
    ["dedent", "\u2325Tab"],
    ["finish", "End"],
    ["up", "Up"],
    ["rename", "F2"],
  ])("", (input, output) => {
    test(`mapCommandToReadableKeyStroke("${input}")`, () => {
      const editorKeybindings = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
      expect(editorKeybindings.mapCommandToReadableKeyStrokes(input)).toEqual([output]);
    });
  });
} else {
  describe.each([
    ["open", "Ctrl+O"],
    ["smeg", "Alt+Shift+S"],
    ["sleep", "Shift+Z"],
    ["pageup", "Page Up"],
    ["gohome", "Home"],
    ["dedent", "Alt+Tab"],
    ["finish", "End"],
    ["up", "Up"],
    ["rename", "F2"],
  ])("", (input, output) => {
    test(`mapCommandToReadableKeyStroke("${input}")`, () => {
      const editorKeybindings = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
      expect(editorKeybindings.mapCommandToReadableKeyStrokes(input)).toEqual([output]);
    });
  });
}
