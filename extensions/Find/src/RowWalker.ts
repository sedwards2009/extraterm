/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Terminal,
  TerminalOutputDetails,
  TerminalOutputType,
  RowPositionType,
  PositionToRowResult
} from '@extraterm/extraterm-extension-api';


export interface RowLocation extends PositionToRowResult {
  index: number;
}

export enum RowWalkerStart {
  TOP_VISIBLE,
  BOTTOM_VISIBLE
}

export class RowWalker {
  #rowLocation: RowLocation;
  #terminal: Terminal;

  constructor(terminal: Terminal, start: RowWalkerStart) {
    this.#terminal = terminal;
    const viewport = this.#terminal.viewport;
    const startPosition = viewport.position + (start === RowWalkerStart.TOP_VISIBLE ? 0 : (viewport.height - 1));
    this.#rowLocation = this.#findRowAtPosition(startPosition, start);
  }

  #findRowAtPosition(position: number, start: RowWalkerStart): RowLocation {
    const blocks = this.#terminal.blocks;
    for (let i=0; i<blocks.length; i++) {
      const block = blocks[i];
      if (block.type !== TerminalOutputType) {
        continue;
      }
      const details = <TerminalOutputDetails> block.details;

      const isInBlock = position >= block.geometry.positionTop && position < (block.geometry.positionTop + block.geometry.height);
      if (isInBlock) {
        const offset = start === RowWalkerStart.TOP_VISIBLE ? block.geometry.titleBarHeight : 0;
        const result = details.positionToRow(position + offset);
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

  scrollUpToRow(): void {
    const block = this.#terminal.blocks[this.#rowLocation.index];
    const details = <TerminalOutputDetails> block.details;
    const newPosition = details.rowToPosition(this.#rowLocation.row, this.#rowLocation.where);
    this.#terminal.viewport.position = newPosition - block.geometry.titleBarHeight;
  }

  scrollDownToRow(): void {
    const block = this.#terminal.blocks[this.#rowLocation.index];
    const details = <TerminalOutputDetails> block.details;
    const newPosition = details.rowToPosition(this.#rowLocation.row, this.#rowLocation.where);
    this.#terminal.viewport.position = newPosition - this.#terminal.viewport.height + details.rowHeight;
  }

  goForward(): boolean {
    const block = this.#terminal.blocks[this.#rowLocation.index];
    const details = <TerminalOutputDetails> block.details;
    if (this.#rowLocation.where === RowPositionType.IN_SCROLLBACK && this.#rowLocation.row < (details.scrollback.height-1)) {
      this.#rowLocation.row++;
      return true;
    }

    if (this.#rowLocation.where === RowPositionType.IN_SCREEN) {
      if (this.#rowLocation.row < (this.#terminal.screen.materializedHeight-1)) {
        this.#rowLocation.row++;
        return true;
      }

      if (details.hasPty) {
        this.#rowLocation.row = 0;
        this.#rowLocation.where = RowPositionType.IN_SCREEN;
        return true;
      }
    }
    return false;
  }
}
