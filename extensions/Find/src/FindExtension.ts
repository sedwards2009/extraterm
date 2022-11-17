/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  Screen,
  Terminal,
  TerminalOutputDetails,
  TerminalBorderWidget,
  TerminalOutputType,
  RowPositionType,
  PositionToRowResult
} from '@extraterm/extraterm-extension-api';
import { countCells } from "extraterm-unicode-utilities";
import escapeStringRegexp from "escape-string-regexp";
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

    const updateHighlight = () => this.#updateHighlight();
    this.#findControls.onSearchTextChanged(updateHighlight);
    this.#findControls.onRegexChanged(updateHighlight);
    this.#findControls.onCaseSensitiveChanged(updateHighlight);
    this.#findControls.onSearchBackwardsClicked(() => this.#searchBackwards());
    this.#findControls.onSearchForwardsClicked(() => this.#searchForwards());

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
      this.#updateHighlight();
    }
    this.#findControls.focus();
  }

  #updateHighlight(): void {
    if ( ! this.#isOpen) {
      return;
    }

    this.#scanAndHighlightTerminal(this.#terminal, this.#buildRegexFromControls());
  }

  #buildRegexFromControls(): RegExp {
    const text = this.#findControls.getSearchText();
    let regex: RegExp = null;
    if (text.trim() !== "") {
      const isRegex = this.#findControls.isRegex();
      const isCaseSensitive = this.#findControls.isCaseSensitive();
      const regexString = isRegex ? text : escapeStringRegexp(text);
      regex = new RegExp(regexString, isCaseSensitive ? "g" : "gi");
    }
    return regex;
  }

  #clearTerminalHighlight(terminal: Terminal): void {
    for (const block of terminal.blocks) {
      if (block.type === TerminalOutputType) {
        const outputDetails = <TerminalOutputDetails> block.details;
        this.#clearHighlight(outputDetails.scrollback, 0, outputDetails.scrollback.height);
      }
    }
    this.#clearHighlight(terminal.screen, 0, terminal.screen.materializedHeight);
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

  #scanAndHighlightTerminal(terminal: Terminal, regex: RegExp): void {
    for (const block of terminal.blocks) {
      if (block.type !== TerminalOutputType) {
        continue;
      }
      const details = <TerminalOutputDetails> block.details;

      const scrollbackRange = this.#clipScreenToViewport(terminal, details, details.scrollback.height, RowPositionType.IN_SCROLLBACK);
      if (scrollbackRange != null) {
        if (regex != null) {
          this.#scanAndHighlight(regex, details.scrollback, scrollbackRange.topRow, scrollbackRange.bottomRow);
        } else {
          this.#clearHighlight(details.scrollback, scrollbackRange.topRow, scrollbackRange.bottomRow);
        }
      }

      if (details.hasPty) {
        const screenRange = this.#clipScreenToViewport(terminal, details, terminal.screen.materializedHeight, RowPositionType.IN_SCREEN);
        if (screenRange != null) {
          if (regex != null) {
            this.#scanAndHighlight(regex, terminal.screen, screenRange.topRow, screenRange.bottomRow);
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

  #scanAndHighlight(regex: RegExp, screen: Screen, startLine: number, endLine: number): void {
    let didChange = false;
    for (let y = startLine; y < endLine; y++) {
      const lineText = screen.getRowText(y);
      const foundList = findText(regex, lineText);
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

  #searchBackwards(): void {
    const rowWalker = new RowWalker(this.#terminal);
    const regex = this.#buildRegexFromControls();
    while (rowWalker.goBack()) {
      const matches = findText(regex, rowWalker.getRowText());
      if (matches.length !== 0) {
        rowWalker.scrollToRow();
        break;
      }
    }
  }

  #searchForwards(): void {

  }

}


interface TextMatch {
  index: number;
  matchText: string;
}

function findText(textRegex: RegExp, text: string): TextMatch[] {
  const result: TextMatch[] = [];
  for (const m of text.matchAll(textRegex)) {
    if (m[0] != null) {
      result.push({ index: m.index, matchText: m[0] });
    }
  }
  return result;
}

interface RowLocation extends PositionToRowResult {
  index: number;
}

class RowWalker {
  #rowLocation: RowLocation;
  #terminal: Terminal;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;
    this.#rowLocation = this.#findRowAtPosition(this.#terminal.viewport.position);
  }

  #findRowAtPosition(position: number): RowLocation {
    const blocks = this.#terminal.blocks;
    for (let i=0; i<blocks.length; i++) {
      const block = blocks[i];
      if (block.type !== TerminalOutputType) {
        continue;
      }
      const details = <TerminalOutputDetails> block.details;

      const isInBlock = position >= block.geometry.positionTop && position < (block.geometry.positionTop + block.geometry.height);
      if (isInBlock) {
        const result = details.positionToRow(position + block.geometry.titleBarHeight);
        if (result.where === RowPositionType.IN_SCREEN || result.where === RowPositionType.IN_SCROLLBACK) {
          return {...result, index: i};
        }
        if (result.where === RowPositionType.ABOVE) {
          return {...result, index: i};
        }
      }
    }
    return {
      index: blocks.length - 1,
      where: RowPositionType.BELOW,
      row: -1
    };
  }

  getRowText(): string {
    if (this.#rowLocation.where === RowPositionType.IN_SCREEN) {
      return this.#terminal.screen.getRowText(this.#rowLocation.row);
    }

    const block = this.#terminal.blocks[this.#rowLocation.index];
    const details = <TerminalOutputDetails> block.details;
    return details.scrollback.getRowText(this.#rowLocation.row);
  }

  goBack(): boolean {
    if (this.#rowLocation.where === RowPositionType.IN_SCROLLBACK && this.#rowLocation.row > 0) {
      this.#rowLocation.row--;
      return true;
    }

    if (this.#rowLocation.where === RowPositionType.IN_SCREEN) {
      if (this.#rowLocation.row > 0) {
        this.#rowLocation.row--;
        return true;
      }
      const block = this.#terminal.blocks[this.#rowLocation.index];
      const details = <TerminalOutputDetails> block.details;
      if (details.scrollback.height > 0) {
        this.#rowLocation.row = details.scrollback.height - 1;
        this.#rowLocation.where = RowPositionType.IN_SCROLLBACK;
        return true;
      }
    }

    const blocks = this.#terminal.blocks;
    let index = this.#rowLocation.index;
    while (index > 0) {
      index--;
      const block = blocks[index];
      if (block.type === TerminalOutputType) {
        const details = <TerminalOutputDetails> block.details;
        if (details.hasPty) {
          this.#rowLocation.index = index;
          this.#rowLocation.where = RowPositionType.IN_SCREEN;
          this.#rowLocation.row = this.#terminal.screen.materializedHeight - 1;
          return true;
        }
        if (details.scrollback.height !== 0) {
          this.#rowLocation.index = index;
          this.#rowLocation.where = RowPositionType.IN_SCROLLBACK;
          this.#rowLocation.row = details.scrollback.height - 1;
          return true;
        }
      }
    }
    return false;
  }

  scrollToRow(): void {
    const block = this.#terminal.blocks[this.#rowLocation.index];
    const details = <TerminalOutputDetails> block.details;
    const newPosition = details.rowToPosition(this.#rowLocation.row, this.#rowLocation.where);
    this.#terminal.viewport.position = newPosition - block.geometry.titleBarHeight;
  }
}
