/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import * as KeybindingsManager from './KeyBindingsManager';
import { eventKeyNameToConfigKeyName } from '../../keybindings/KeybindingsMapping';

SourceMapSupport.install();

const keyBindingsMap = {
  "editor": {
    "Ctrl-o": "open",
    "Ctrl-Space": "togglemode",
    "Ctrl-Plus": "zoom",
    "Alt-Shift-Cmd-A": "all",
    "space": "makespace",
    "alt - shift - S": "smeg",
    "W-ctrl-shift": "closewindow",
    "shift-shift-shift-Z": "sleep",
    "PageUp": "pageup",
    "home": "gohome",
    "Alt-Tab": "dedent",
    "Ctrl-Tab": "otherpane",
    "End": "finish",
    "ArrowUp": "up",
    "Down": "down",
    "F2": "rename",
    "Alt-ArrowLeft": "select-left",
    "Ctrl-c": "break",
    "Ctrl-Shift-C": "bigbreak",
    "Ctrl-Alt-.": "moveTabRight"
  }
};

export function testContext(test: nodeunit.Test): void {
  const cutsContexts = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
  const editorKeybindings = cutsContexts.context("editor");
  
  test.notEqual(editorKeybindings, null);
  test.notEqual(editorKeybindings, undefined);
  test.done();
}

function keyCode(key: string, ctrl=true): number {
  if (key.length !== 1) {
    return 0;
  } else {
    return ctrl ? key.charCodeAt(0) & ~0x0040 : key.charCodeAt(0);
  }
}

export function testEventKeyNameToConfigKeyName(test: nodeunit.Test): void {
  test.equal(eventKeyNameToConfigKeyName(" "), "Space");
  test.equal(eventKeyNameToConfigKeyName("ArrowUp"), "Up");
  test.done();
}

export function testMapEventToCommand(test: nodeunit.Test): void {
  const cutsContexts = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
  const editorKeybindings = cutsContexts.context("editor");

  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "o", keyCode: keyCode("o") }), "open");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ") }), "togglemode");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "+", keyCode: keyCode("+") }), "zoom");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: true, ctrlKey: false, metaKey: true, shiftKey: true, key: "A", keyCode: keyCode("A",false) }), "all");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ",false) }), "makespace");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, key: "S", keyCode: keyCode("S",false) }), "smeg");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "W", keyCode: keyCode("W") }), "closewindow");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: true, key: "Z", keyCode: keyCode("Z",false) }), "sleep");  
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "PageUp", keyCode: keyCode("PageUp",false) }), "pageup");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }), "gohome");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }), "gohome");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "Tab", keyCode: keyCode("Tab",false) }), "dedent");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "End", keyCode: keyCode("End",false) }), "finish");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowUp", keyCode: keyCode("ArrowUp",false) }), "up");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowDown", keyCode: keyCode("ArrowDown",false) }), "down");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "F2", keyCode: keyCode("F2",false) }), "rename");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowLeft", keyCode: keyCode("ArrowLeft",false) }), "select-left");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "Tab", keyCode: 9 }), "otherpane");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "c", keyCode: 67 }), "break");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "C", keyCode: 67 }), "bigbreak");
  test.equal(editorKeybindings.mapEventToCommand({ isComposing: false, altKey: true, ctrlKey: true, metaKey: false, shiftKey: false, key: ".", keyCode: 190 }), "moveTabRight");
  
  test.done();
}

export function testMapCommandToKeybindings(test: nodeunit.Test): void {
  const cutsContexts = KeybindingsManager.loadKeybindingsFromObject(keyBindingsMap, "linux");
  const editorKeybindings = cutsContexts.context("editor");
  
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("open"), "Ctrl+O");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("smeg"), "Alt+Shift+S");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("sleep"), "Shift+Z");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("pageup"), "Page Up");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("gohome"), "Home");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("dedent"), "Alt+Tab");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("finish"), "End");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("up"), "Up");
  test.equal(editorKeybindings.mapCommandToHumanKeybinding("rename"), "F2");

  test.done();
}
