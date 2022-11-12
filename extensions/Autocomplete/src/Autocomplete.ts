/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  ListPickerOptions,
  Screen,
  TerminalOutputDetails,
  TerminalOutputType,
} from '@extraterm/extraterm-extension-api';

let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("autocomplete:autocomplete", autocompleteCommand);
}

async function autocompleteCommand(): Promise<void> {
  const words = collectWords();
  const defaultFilter = getDefaultFilter();
  const candidateWords = words.filter(w => w !== defaultFilter);

  const options: ListPickerOptions = {
    items: candidateWords,
    selectedItemIndex: 0,
    filter: defaultFilter
  };

  const selected = await context.activeTerminal.showOnCursorListPicker(options);
  if (selected == null) {
    return;
  }

  const deleteKeyStrokes = "\x7f".repeat(defaultFilter.length);
  context.activeTerminal.type(deleteKeyStrokes + words[selected]);
}

function collectWords(): string[] {
  const blocks = context.activeTerminal.blocks;
  let blockIndex = blocks.length -1;
  const screenLines: string[] = [];

  const maxScanRows = context.activeTerminal.screen.height * 2;

  while (screenLines.length < maxScanRows && blockIndex >= 0) {
    const block = blocks[blockIndex];
    if (block.type === TerminalOutputType) {
      const details = <TerminalOutputDetails> block.details;
      if (details.hasPty) {
        scanScreen(context.activeTerminal.screen, screenLines, maxScanRows);
      }
      scanScreen(details.scrollback, screenLines, maxScanRows);
    }
    blockIndex--;
  }

  const wordsSet = new Set<string>(screenLines.join(" ").split(" ").filter(s => s.trim() !== "")
    .filter(s => s.length > 3));
  const words = Array.from(wordsSet);
  words.sort();
  return words;
}

function scanScreen(screen: Screen, screenLines: string[], maxScanRows: number): void {
  for(let i=screen.height-1; i>=0 && screenLines.length<maxScanRows; i--) {
    const line = screen.getRowText(i);
    if (line.trim() !== "") {
      screenLines.push(line);
    }
  }
}

function getDefaultFilter(): string {
  const screen = context.activeTerminal.screen;
  const lineText = screen.getRowText(screen.cursorRow);
  let xStart = screen.cursorX;

  while (xStart !== 0 && lineText.charAt(xStart-1) !== " ") {
    xStart--;
  }

  return lineText.substring(xStart, screen.cursorX);
}
