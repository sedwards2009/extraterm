/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, ListPickerOptions } from '@extraterm/extraterm-extension-api';
import * as path from 'node:path';
import { PageDatabase } from './PageDatabase.js';


let log: Logger = null;
let context: ExtensionContext = null;

let commandDatabase: PageDatabase = null;

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("tldr-pages:tldr", showCommandList);

  commandDatabase = new PageDatabase(path.join(context.extensionPath, "data", "pages"));
  commandDatabase.loadIndex();
}

async function showCommandList(): Promise<void> {
  const allCommandsOptions: ListPickerOptions = {
    title: "TLDR Pages",
    items: commandDatabase.getCommandNames(),
    selectedItemIndex: 0,
  };

  const selected = await context.activeTerminal.tab.showListPicker(allCommandsOptions);
  if (selected == null) {
    return;
  }

  const info = await commandDatabase.getPageInfoByIndex(selected);

  const commandOptions: ListPickerOptions = {
    title: info.description,
    items: info.examples.map(ex => ex.description),
    selectedItemIndex: 0,
  };
  const selectedExample = await context.activeTerminal.tab.showListPicker(commandOptions);
  if (selectedExample == null) {
    return;
  }
  context.activeTerminal.type(info.examples[selectedExample].commandLine);
}
