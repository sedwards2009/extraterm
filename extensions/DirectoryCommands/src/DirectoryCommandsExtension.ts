/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  CustomizedCommand,
  ExtensionContext,
  Logger,
} from '@extraterm/extraterm-extension-api';


let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.commands.registerCommand("directory-commands:copyDirectoryToClipboard", copyDirectoryCommand,
    copyDirectoryTitleFunc);
  context.commands.registerCommand("directory-commands:copyDirectoryInFileManager", copyDirectoryInFileManagerCommand,
    copyDirectoryInFileManagerFunc);
}

async function copyDirectoryCommand(): Promise<void> {
  const cwd = await context.window.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    return;
  }

  context.application.clipboard.writeText(cwd);
}

function copyDirectoryTitleFunc(): CustomizedCommand {
  return { title: context.application.isMacOS ? "Copy Folder Path to Clipboard" : "Copy Directory Path to Clipboard" };
}

async function copyDirectoryInFileManagerCommand(): Promise<void> {
  const cwd = await context.window.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    return;
  }

  context.application.showItemInFileManager(cwd);
}

function copyDirectoryInFileManagerFunc(): CustomizedCommand {
  return { title: context.application.isMacOS ? "Open Folder in Finder" : "Open Directory in File Manager" };
}
