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
  const words = collectWords();
  const defaultFilter = getDefaultFilter();

  const candidateWords = words.filter(w => w !== defaultFilter);

  const options: OnCursorListPickerOptions = {
    items: candidateWords,
    selectedItemIndex: 0,
    filter: defaultFilter
  };

  const selected = await context.window.activeTerminal.showOnCursorListPicker(options);
  if (selected == null) {
    return;
  }

  const deleteKeyStrokes = "\x7f".repeat(defaultFilter.length);
  context.window.activeTerminal.type(deleteKeyStrokes + words[selected]);
}

function collectWords(): string[] {
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
  return words;
}

function scanScreen(screen: Screen, screenLines: string[]): void {
  for(let i=screen.height-1; i>=0 && screenLines.length<MAX_SCAN_ROWS; i--) {
    const line = screen.getLineText(i);
    if (line.trim() !== "") {
      screenLines.push(line);
    }
  }
}

function getDefaultFilter(): string {
  const screen = context.window.activeTerminal.screen;
  const lineText = screen.getLineText(screen.cursorLine);
  let xStart = screen.cursorX;

  while (xStart !== 0 && lineText.charAt(xStart-1) !== " ") {
    xStart--;
  }

  return lineText.substr(xStart, screen.cursorX - xStart);
}
