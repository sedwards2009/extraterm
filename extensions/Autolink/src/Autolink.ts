/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  LineRangeChange,
  Screen,
  Terminal,
  TerminalOutputDetails
} from '@extraterm/extraterm-extension-api';

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  for (const terminal of context.window.terminals) {
    terminal.onDidAppendScrollbackLines(scanAndLinkScrollback);
    terminal.onDidScreenChange((ev: LineRangeChange) => {
      scanAndLinkScreen(terminal, ev);
    });
  }

  context.window.onDidCreateTerminal((newTerminal: Terminal) => {
    newTerminal.onDidAppendScrollbackLines(scanAndLinkScrollback);
    newTerminal.onDidScreenChange((ev: LineRangeChange) => {
      scanAndLinkScreen(newTerminal, ev);
    });
  });
}

const httpRegex = new RegExp("https?://\\S+", "g");

function scanAndLinkScrollback(ev: LineRangeChange): void {
  const details = <TerminalOutputDetails> ev.block.details;
  scanAndLink(details.scrollback, ev);
}

function scanAndLinkScreen(terminal: Terminal, ev: LineRangeChange): void {
  scanAndLink(terminal.screen, ev);
}

function scanAndLink(screen: Screen, ev: LineRangeChange): void {
  for (let y = ev.startLine; y < ev.endLine; y++) {
    const line = screen.getLineText(y);
    log.debug(`Saw line '${line}'`);
    for (const found of (<any>line).matchAll(httpRegex)) {
      const url = found[0];
      log.debug(`Saw '${url}'`);
      screen.applyHyperlink(y, found.index, url.length, url);
    }
  }
}
