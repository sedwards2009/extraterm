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
  context.commands.registerCommand("copy-link:copyLink", copyLinkCommand, commandNameFunc);
}

function commandNameFunc(): CustomizedCommand {
  if (getProtocol(context.window.activeHyperlinkURL) === "file:") {
    return {
      title: `Copy Path`
    }
  } else {
    return {
      title: `Copy Link`
    }
  }
}

function copyLinkCommand(): void {
  let text = context.window.activeHyperlinkURL;
  try {
    const url = new URL(text);
    if (url.protocol === "file:") {
      text = url.pathname;
    }
  } catch(e) {
    log.debug(e);
  }

  context.application.clipboard.writeText(text);
}

function getProtocol(link: string): string {
  try {
    const url = new URL(link);
    return url.protocol;
  } catch(e) {
  }
  return null;
}
