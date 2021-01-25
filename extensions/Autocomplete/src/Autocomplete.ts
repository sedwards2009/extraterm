/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  OnCursorListPickerOptions,
  Screen,
  TerminalOutputDetails,
  TerminalOutputType,
} from '@extraterm/extraterm-extension-api';

let log: Logger = null;
let context: ExtensionContext = null;

const MAX_SCAN_ROWS = 50;

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("autocomplete:autocomplete", autocompleteCommand);
}

async function autocompleteCommand(): Promise<void> {
  const blocks = context.window.activeTerminal.blocks;
  let blockIndex = blocks.length -1;
  const screenLines: string[] = [];

  while (screenLines.length < MAX_SCAN_ROWS && blockIndex >= 0) {
    const block = blocks[blockIndex];
    if (block.type === TerminalOutputType) {
      const details = <TerminalOutputDetails> block.details;
      if (details.hasPty) {
        scanScreen(context.window.activeTerminal.screen, screenLines);
      }
      scanScreen(details.scrollback, screenLines);
    }
    blockIndex--;
  }

  const wordsSet = new Set<string>(screenLines.join(" ").split(" ").filter(s => s.trim() !== "")
    .filter(s => s.length > 3));
  const words = Array.from(wordsSet);
  words.sort();

  const options: OnCursorListPickerOptions = {
    items: words,
    selectedItemIndex: 0,
  };

  const selected = await context.window.activeTerminal.showOnCursorListPicker(options);
  if (selected == null) {
    return;
  }

  context.window.activeTerminal.type(words[selected]);
}

function scanScreen(screen: Screen, screenLines: string[]): void {
  for(let i=screen.height-1; i>=0 && screenLines.length<MAX_SCAN_ROWS; i--) {
    const line = screen.getLineText(i);
    if (line.trim() !== "") {
      screenLines.push(line);
    }
  }
}
