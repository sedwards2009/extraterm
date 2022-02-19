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
  context.commands.registerCommand("directory-commands:openDirectoryInFileManager", openDirectoryInFileManagerCommand,
    openDirectoryInFileManagerFunc);
}

async function copyDirectoryCommand(): Promise<void> {
  const cwd = await context.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    log.warn("No cwd to copy in openDirectoryInFileManagerCommand()");
    return;
  }

  context.application.clipboard.writeText(cwd);
}

function copyDirectoryTitleFunc(): CustomizedCommand {
  return { title: context.application.isMacOS ? "Copy Folder Path to Clipboard" : "Copy Directory Path to Clipboard" };
}

async function openDirectoryInFileManagerCommand(): Promise<void> {
  const cwd = await context.activeTerminal.getWorkingDirectory();
  if (cwd == null) {
    log.warn("No cwd to open in openDirectoryInFileManagerCommand()");
    return;
  }

  context.application.showItemInFileManager(cwd);
}

function openDirectoryInFileManagerFunc(): CustomizedCommand {
  return { title: context.application.isMacOS ? "Open Folder in Finder" : "Open Directory in File Manager" };
}
