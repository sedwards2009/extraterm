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
  TerminalOutputType,
  RowPositionType
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

    const updateHighlight = () => this.#updateHighlight();
    terminal.onDidAppendScrollbackLines(updateHighlight);
    terminal.onDidScreenChange(updateHighlight);
    terminal.viewport.onDidChange(updateHighlight);
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

  #updateHighlight(): void {
    if ( ! this.#isOpen) {
      return;
    }
    this.#scanAndHighlightTerminal(this.#terminal, this.#findControls.getSearchText());
  }

  #scanAndHighlightTerminal(terminal: Terminal, text: string): void {
    for (const block of terminal.blocks) {
      if (block.type !== TerminalOutputType) {
        continue;
      }
      const details = <TerminalOutputDetails> block.details;

      const scrollbackRange = this.#clipScreenToViewport(terminal, details, details.scrollback.height, RowPositionType.IN_SCROLLBACK);
      if (scrollbackRange != null) {
        if (text !== "") {
          this.#scanAndHighlight(text, details.scrollback, scrollbackRange.topRow, scrollbackRange.bottomRow);
        } else {
          this.#clearHighlight(details.scrollback, scrollbackRange.topRow, scrollbackRange.bottomRow);
        }
      }

      if (details.hasPty) {
        const screenRange = this.#clipScreenToViewport(terminal, details, terminal.screen.materializedHeight, RowPositionType.IN_SCREEN);
        if (screenRange != null) {
          if (text !== "") {
            this.#scanAndHighlight(text, terminal.screen, screenRange.topRow, screenRange.bottomRow);
          } else {
            this.#clearHighlight(terminal.screen, screenRange.topRow, screenRange.bottomRow);
          }
        }
      }
    }
  }

  #clipScreenToViewport(terminal: Terminal, blockDetails: TerminalOutputDetails, height: number,
      inside: RowPositionType): {topRow: number, bottomRow: number} {

    const viewport = terminal.viewport;
    let topRow = 0;
    let bottomRow = height;
    const topPosResult = blockDetails.positionToRow(viewport.position);
    if (topPosResult.where === RowPositionType.BELOW) {
      return null;
    }
    if (topPosResult.where === inside) {
      topRow = topPosResult.row;
    }

    const bottomPosResult = blockDetails.positionToRow(viewport.position + viewport.height-1);
    if (bottomPosResult.where === RowPositionType.ABOVE) {
      return null;
    }
    if (bottomPosResult.where === inside) {
      bottomRow = bottomPosResult.row + 1;
    }

    return {
      topRow,
      bottomRow
    };
  }

  #scanAndHighlight(text: string, screen: Screen, startLine: number, endLine: number): void {
    const textRegex = RegExp(`(?<text>${text})`, "gi"); // TODO escape the text
    let didChange = false;
    for (let y = startLine; y < endLine; y++) {
      const lineText = screen.getRowText(y);
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
