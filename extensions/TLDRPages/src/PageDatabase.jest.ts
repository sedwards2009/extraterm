/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";
import { PageDatabase } from "./PageDatabase";

test("Scan", async () => {
  const db = new PageDatabase("./data/pages");
  await db.loadIndex();

  const commandNames = db.getCommandNames();

  expect(commandNames).not.toBe(0);
  expect(commandNames.indexOf("ack")).not.toBe(-1);

  const info = await db.getPageInfoByName("cd", "windows");

  expect(info.examples.length).toBe(4);
  expect(info.examples[0].commandLine).toMatch(/^[^`].*[^`]$/);
  expect(info.examples[0].description).toMatch(/^.*[^:]$/);
});
