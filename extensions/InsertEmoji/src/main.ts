/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, ListPickerOptions } from '@extraterm/extraterm-extension-api';
import { emojiNames, emojiCodePoints } from "./EmojiData";


let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("insert-emoji:insert-emoji", showEmojiList);

}

async function showEmojiList(): Promise<void> {
  const allEmojiOptions: ListPickerOptions = {
    title: "Insert Emoji",
    items: emojiNames,
    selectedItemIndex: 0,
  };

  const selected = await context.window.activeTerminal.getTab().showListPicker(allEmojiOptions);
  if (selected == null) {
    return;
  }

  context.window.activeTerminal.type(String.fromCodePoint(emojiCodePoints[selected]));
}
