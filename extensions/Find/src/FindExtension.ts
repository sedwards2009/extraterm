/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  LineRangeChange,
  Screen,
  Terminal,
  TerminalOutputDetails,
  TerminalBorderWidget,
  TerminalOutputType
} from '@extraterm/extraterm-extension-api';
import { countCells } from "extraterm-unicode-utilities";
import { FindControls } from './FindControls';

let log: Logger = null;
let context: ExtensionContext = null;

const LAYER_NAME = "find";

const terminalToFindExtensionMap = new WeakMap<Terminal, FindExtension>();


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.commands.registerCommand("find:find", commandFind.bind(null, context));

  for (const terminal of context.terminals.terminals) {
    terminalToFindExtensionMap.set(terminal, new FindExtension(terminal));
  }
  context.terminals.onDidCreateTerminal((newTerminal: Terminal) => {
    terminalToFindExtensionMap.set(newTerminal, new FindExtension(newTerminal));
  });
}

function commandFind(context: ExtensionContext): void {
  const terminalExtension = terminalToFindExtensionMap.get(context.activeTerminal);
  if (terminalExtension != null) {
    terminalExtension.open();
  }
}

class FindExtension {
  #terminal: Terminal = null;
  #borderWidget: TerminalBorderWidget = null;
  #findControls: FindControls = null;
  #isOpen = false;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;

    // terminal.onDidAppendScrollbackLines(scanAndHighlightScrollback);
    // terminal.onDidScreenChange((ev: LineRangeChange) => {
    // //   scanAndHighlightScreen(terminal, ev);
    // });
  }

  #initBorderWidget(): void {
    this.#borderWidget = this.#terminal.createTerminalBorderWidget("find");

    this.#findControls = new FindControls(this.#terminal.tab.window.style, log);
    this.#findControls.onCloseRequest(() => {
      this.#handleCloseRequest();
    });
    this.#findControls.onSearchTextChanged((text: string) => {
      this.#scanAndHighlightTerminal(this.#terminal, text);
    });
    this.#borderWidget.contentWidget = this.#findControls.getWidget();
  }

  #handleCloseRequest(): void {
    this.#borderWidget.close();
    this.#clearTerminalHighlight(this.#terminal);
    this.#isOpen = false;
  }

  open(): void {
    if (this.#borderWidget == null) {
      this.#initBorderWidget();
    }
    if ( ! this.#isOpen) {
      this.#borderWidget.open();
      this.#isOpen = true;

      const searchText = this.#findControls.getSearchText().trim();
      if (searchText !== "") {
        this.#scanAndHighlightTerminal(this.#terminal, searchText);
      }
    }
    this.#findControls.focus();
  }

  #clearTerminalHighlight(terminal: Terminal): void {
    for (const block of terminal.blocks) {
      if (block.type === TerminalOutputType) {
        const outputDetails = <TerminalOutputDetails> block.details;
        this.#clearHighlight(outputDetails.scrollback, 0, outputDetails.scrollback.height);
      }
    }
    this.#clearHighlight(terminal.screen, 0, terminal.screen.height);
  }

  #clearHighlight(screen: Screen, startLine: number, endLine: number): void {
    let didChange = false;
    for (let y = startLine; y < endLine; y++) {
      if (screen.hasLayerRow(y, LAYER_NAME)) {
        const layerRow = screen.getLayerRow(y, LAYER_NAME);
        layerRow.clear();
        didChange = true;
      }
    }
    if (didChange) {
      screen.redraw();
    }
  }

  #scanAndHighlightTerminal(terminal: Terminal, text: string): void {
    for (const block of terminal.blocks) {
      if (block.type === TerminalOutputType) {
        const outputDetails = <TerminalOutputDetails> block.details;
        if (text !== "") {
          this.#scanAndHighlight(text, outputDetails.scrollback, 0, outputDetails.scrollback.height);
        } else {
          this.#clearHighlight(outputDetails.scrollback, 0, outputDetails.scrollback.height);
        }
      }
    }
    if (text !== "") {
      this.#scanAndHighlight(text, terminal.screen, 0, terminal.screen.height);
    } else {
      this.#clearHighlight(terminal.screen, 0, terminal.screen.height);
    }
  }

  #scanAndHighlight(text: string, screen: Screen, startLine: number, endLine: number): void {
    const textRegex = RegExp(`(?<text>${text})`, "gi"); // TODO escape the text
    let didChange = false;
    for (let y = startLine; y < endLine; y++) {
      const lineText = screen.getLineText(y);
      const foundList = findText(textRegex, lineText);
      if (foundList.length !== 0) {
        const layerRow = screen.getLayerRow(y, LAYER_NAME);
        layerRow.clear();
        for (const found of foundList) {
          const index = countCells(lineText.substring(0, found.index));
          layerRow.setString(index, found.matchText);

          const matchWidthCells = countCells(found.matchText);
          for (let i=0; i<matchWidthCells; i++) {
            layerRow.setFgClutIndex(index + i, 0);
            layerRow.setBgClutIndex(index + i, 11);
          }
        }
        didChange = true;
      } else {
        if (screen.hasLayerRow(y, LAYER_NAME)) {
          const layerRow = screen.getLayerRow(y, LAYER_NAME);
          layerRow.clear();
          didChange = true;
        }
      }
    }
    if (didChange) {
      screen.redraw();
    }
  }
}


interface TextMatch {
  index: number;
  matchText: string;
}

function findText(textRegex: RegExp, text: string): TextMatch[] {
  const result: TextMatch[] = [];
  for (const m of text.matchAll(textRegex)) {
    if (m.groups.text != null) {
      result.push({ index: m.index, matchText: m.groups.text });
    }
  }
  return result;
}
