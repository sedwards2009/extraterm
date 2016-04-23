/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import KeyBindingsManager = require('./keybindingmanager');

sourceMapSupport.install();

const keyBindingsMap = {
  "editor": {
    "Ctrl-O": "open",
    "Ctrl-Space": "togglemode",
    "Ctrl-Plus": "zoom",
    "Alt-Shift-Cmd-A": "all",
    "space": "makespace",
    "alt - shift - s": "smeg",
    "W-ctrl-shift": "closewindow",
    "shift-shift-shift-z": "sleep",
    "PageUp": "pageup",
    "home": "gohome",
    "Alt-Tab": "dedent",
    "End": "finish",
    "ArrowUp": "up",
    "Down": "down",
    "F2": "rename",
    "Alt-ArrowLeft": "select-left"
  }
};

export function testContext(test: nodeunit.Test): void {
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap);
  const editorKeyBindings = cutsContexts.context("editor");
  
  test.notEqual(editorKeyBindings, null);
  test.notEqual(editorKeyBindings, undefined);
  test.done();
}

export function testMapEventToCommand(test: nodeunit.Test): void {
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap);
  const editorKeyBindings = cutsContexts.context("editor");
  
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "O" }), "open");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: " " }), "togglemode");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "+" }), "zoom");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: true, shiftKey: true, key: "A" }), "all");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: " " }), "makespace");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, key: "S" }), "smeg");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "W" }), "closewindow");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: true, key: "Z" }), "sleep");  
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "PageUp" }), "pageup");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home" }), "gohome");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "Tab" }), "dedent");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "End" }), "finish");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowUp" }), "up");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowDown" }), "down");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "F2" }), "rename");
  test.equal(editorKeyBindings.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowLeft" }), "select-left");
  
  test.done();
}

export function testMapCommandToKeyBindings(test: nodeunit.Test): void {
  const cutsContexts = KeyBindingsManager.loadKeyBindingsFromObject(keyBindingsMap);
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
