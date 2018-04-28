/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import * as KeyBindingsManager from './KeyBindingsManager';

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
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap, "linux");
  const editorKeyBindings = cutsContexts.context("editor");
  
  test.notEqual(editorKeyBindings, null);
  test.notEqual(editorKeyBindings, undefined);
  test.done();
}

function keyCode(key: string, ctrl=true): number {
  if (key.length !== 1) {
    return 0;
  } else {
    return ctrl ? key.charCodeAt(0) & ~0x0040 : key.charCodeAt(0);
  }
}

export function testMapEventToCommand(test: nodeunit.Test): void {
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap, "linux");
  const editorKeyBindings = cutsContexts.context("editor");

  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "o", keyCode: keyCode("o") }), "open");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ") }), "togglemode");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "+", keyCode: keyCode("+") }), "zoom");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: true, shiftKey: true, key: "A", keyCode: keyCode("A",false) }), "all");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: " ", keyCode: keyCode(" ",false) }), "makespace");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, key: "S", keyCode: keyCode("S",false) }), "smeg");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "W", keyCode: keyCode("W") }), "closewindow");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: true, key: "Z", keyCode: keyCode("Z",false) }), "sleep");  
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "PageUp", keyCode: keyCode("PageUp",false) }), "pageup");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }), "gohome");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home", keyCode: keyCode("Home",false) }), "gohome");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "Tab", keyCode: keyCode("Tab",false) }), "dedent");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "End", keyCode: keyCode("End",false) }), "finish");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowUp", keyCode: keyCode("ArrowUp",false) }), "up");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowDown", keyCode: keyCode("ArrowDown",false) }), "down");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "F2", keyCode: keyCode("F2",false) }), "rename");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowLeft", keyCode: keyCode("ArrowLeft",false) }), "select-left");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "Tab", keyCode: 9 }), "otherpane");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "c", keyCode: 67 }), "break");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "C", keyCode: 67 }), "bigbreak");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: true, metaKey: false, shiftKey: false, key: ".", keyCode: 190 }), "moveTabRight");
  
  test.done();
}

export function testMapCommandToKeyBindings(test: nodeunit.Test): void {
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap, "linux");
  const editorKeyBindings = cutsContexts.context("editor");
  
  test.equal(editorKeyBindings.mapCommandToKeyBinding("open"), "Ctrl+O");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("smeg"), "Alt+Shift+S");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("sleep"), "Shift+Z");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("pageup"), "Page Up");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("gohome"), "Home");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("dedent"), "Alt+Tab");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("finish"), "End");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("up"), "Up");
  test.equal(editorKeyBindings.mapCommandToKeyBinding("rename"), "F2");

  test.done();
}
