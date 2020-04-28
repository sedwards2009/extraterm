/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import 'jest';

import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { MainExtensionManager } from './extension/MainExtensionManager';


test("Scan & Flatten", () => {
  const extensionManager = new MainExtensionManager(["../extensions"]);
  extensionManager.startUpExtensions({"default-keybindings": true}, false);

  const kbm = new KeybindingsIOManager(".", extensionManager);

  const flatBindings = kbm.getFlatKeybindingsSet("pc-style");
  expect(flatBindings.extends).toBe("pc-style");
  expect(flatBindings.bindings.length).not.toBe(0);

  expect(flatBindings.bindings.filter(b => b.command === "extraterm:window.newTerminal").length).toBe(1);
});
