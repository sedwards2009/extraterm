/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
} from '@extraterm/extraterm-extension-api';


let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.commands.registerCommand("directory-commands:copyDirectoryToClipboard", copyDirectoryCommand);
  context.commands.registerCommand("directory-commands:copyDirectoryInFileManager", copyDirectoryInFileManagerCommand);
}

async function copyDirectoryCommand(): Promise<void> {
  const cwd = await context.window.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    return;
  }

  context.application.clipboard.writeText(cwd);
}

async function copyDirectoryInFileManagerCommand(): Promise<void> {
  const cwd = await context.window.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    return;
  }

  context.application.showItemInFileManager(cwd);
}
