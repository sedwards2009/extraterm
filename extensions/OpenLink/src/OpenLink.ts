/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, CustomizedCommand } from '@extraterm/extraterm-extension-api';

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("open-link:open-link", openLinkCommand, commandNameFunc);
}

function commandNameFunc(): CustomizedCommand {
  return {
    title: `Open ${shortenURL(context.window.activeHyperlinkURL)}`
  }
}

const MAX_URL_DISPLAY_LENGTH = 34;
const START_CHARS_LENGTH = 16;
const END_CHARS_LENGTH = 16;

function shortenURL(url: string): string {
  if (url == null) {
    return url;
  }
  if (url.length > MAX_URL_DISPLAY_LENGTH) {
    return url.substr(0, START_CHARS_LENGTH) + "\u2026" + url.substr(-END_CHARS_LENGTH)
  } else {
    return url;
  }
}

function openLinkCommand(): void {
  context.application.openExternal(context.window.activeHyperlinkURL);
}
