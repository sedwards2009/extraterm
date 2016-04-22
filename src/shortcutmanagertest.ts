/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import ShortcutManager = require('./shortcutmanager');

sourceMapSupport.install();

const keyMap = {
  "editor": {
    "Ctrl+O": "open",
    "Ctrl+Space": "togglemode",
    "Ctrl+Plus": "zoom",
    "Alt+Shift+Cmd+A": "all",
    "space": "makespace",
    "alt + shift + s": "smeg",
    "W+ctrl+shift": "closewindow",
    "shift+shift+shift+z": "sleep",
    "PageUp": "pageup",
    "home": "gohome",
    "Alt+Tab": "dedent",
    "End": "finish",
    "ArrowUp": "up",
    "F2": "rename",
  }
};

export function testContext(test: nodeunit.Test): void {
  const cutsContexts = ShortcutManager.loadShortcutsFromObject(keyMap);
  const editorShortcuts = cutsContexts.context("editor");
  
  test.notEqual(editorShortcuts, null);
  test.notEqual(editorShortcuts, undefined);
  test.done();
}

export function testMapEventToCommand(test: nodeunit.Test): void {
  const cutsContexts = ShortcutManager.loadShortcutsFromObject(keyMap);
  const editorShortcuts = cutsContexts.context("editor");
  
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "o" }), "open");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: " " }), "togglemode");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, key: "+" }), "zoom");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: true, shiftKey: true, key: "a" }), "all");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: " " }), "makespace");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, key: "s" }), "smeg");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: true, key: "w" }), "closewindow");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: true, key: "z" }), "sleep");  
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "PageUp" }), "pageup");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "Home" }), "gohome");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: "Tab" }), "dedent");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "End" }), "finish");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "ArrowUp" }), "up");
  test.equal(editorShortcuts.mapEventToCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: "F2" }), "rename");
  
  test.done();
}

export function testMapCommandToShortcut(test: nodeunit.Test): void {
  const cutsContexts = ShortcutManager.loadShortcutsFromObject(keyMap);
  const editorShortcuts = cutsContexts.context("editor");
  
  test.equal(editorShortcuts.mapCommandToShortcut("open"), "Ctrl+O");
  test.equal(editorShortcuts.mapCommandToShortcut("smeg"), "Alt+Shift+S");
  test.equal(editorShortcuts.mapCommandToShortcut("sleep"), "Shift+Z");
  test.equal(editorShortcuts.mapCommandToShortcut("pageup"), "Page Up");
  test.equal(editorShortcuts.mapCommandToShortcut("gohome"), "Home");
  test.equal(editorShortcuts.mapCommandToShortcut("dedent"), "Alt+Tab");
  test.equal(editorShortcuts.mapCommandToShortcut("finish"), "End");
  test.equal(editorShortcuts.mapCommandToShortcut("up"), "Arrow Up");
  test.equal(editorShortcuts.mapCommandToShortcut("rename"), "F2");

  test.done();
}
