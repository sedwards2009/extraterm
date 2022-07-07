/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  Screen,
  TerminalOutputDetails,
} from '@extraterm/extraterm-extension-api';


let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("copy-block:copyBlockToClipboard", copyBlockCommand);
  context.commands.registerCommand("copy-block:copyCommandLineToClipboard", copyCommandLineCommand);
}

async function copyBlockCommand(): Promise<void> {
  const block = context.activeBlock;
  const details = <TerminalOutputDetails> block.details;

  let text = screenToString(details.scrollback);
  if (details.hasPty) {
    text += screenToString(context.activeTerminal.screen);
  }

  context.application.clipboard.writeText(text);
}

function screenToString(screen: Screen): string {
  const height = screen.height;
  const lines: string[] = [];
  for (let y=0; y<height; y++) {
    const line = screen.getLineText(y);
    if ( ! screen.isLineWrapped(y)) {
      lines.push(line.trimEnd());
      lines.push("\n");
    } else {
      lines.push(line);
    }
  }
  return lines.join("");

}

async function copyCommandLineCommand(): Promise<void> {
  const block = context.activeBlock;
  const details = <TerminalOutputDetails> block.details;
  context.application.clipboard.writeText(details.commandLine);
}
