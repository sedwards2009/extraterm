/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, ListPickerOptions } from '@extraterm/extraterm-extension-api';
import { emojiNames, emojiCodePoints } from "./EmojiData.js";


let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("insert-emoji:insert-emoji", showEmojiList);
}

async function showEmojiList(): Promise<void> {
  const allEmojiOptions: ListPickerOptions = {
    items: emojiNames,
    selectedItemIndex: 0,
    widthPx: 250,
  };

  const selected = await context.activeTerminal.showOnCursorListPicker(allEmojiOptions);
  if (selected == null) {
    return;
  }

  context.activeTerminal.type(String.fromCodePoint(emojiCodePoints[selected]));
}
