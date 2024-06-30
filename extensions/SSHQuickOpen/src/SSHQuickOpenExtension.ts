/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger } from '@extraterm/extraterm-extension-api';

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("ssh-quick-open:open", quickOpenCommand);
}

async function quickOpenCommand(): Promise<void> {
  const selected = await context.activeTerminal.tab.showTextInput({
    message: "Enter a command",
    value: "",
  });
}
