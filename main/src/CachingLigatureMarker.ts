/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import * as lru from 'lru-cache';

import { getLogger, Logger } from "extraterm-logging";
import { CharCellGrid, FLAG_MASK_WIDTH, FLAG_MASK_LIGATURE } from 'extraterm-char-cell-grid';

export interface LigatureMarker {
    markLigaturesCharCellGridRow(grid: CharCellGrid, row: number, text: string): void;
}

interface PlainLigatureMarker {
  markLigaturesCharCellGridRow(grid: CharCellGrid, row: number): void;
}

export class CachingLigatureMarker implements LigatureMarker {
  private _log: Logger;

  private _cache: lru.Cache<string, Uint8Array> = null;

  constructor(private _marker: PlainLigatureMarker) {
    this._log = getLogger("CachingLigatureMarker", this);

    this._cache = lru({
      max: 1024
    });
  }

  markLigaturesCharCellGridRow(grid: CharCellGrid, row: number, text: string): void {
    if (text == null) {
      this._marker.markLigaturesCharCellGridRow(grid, row);
      return;
    }

    const rowFlags = this._cache.get(text);
    if (rowFlags == null) {
      this._marker.markLigaturesCharCellGridRow(grid, row);
      const rowFlags = grid.getRowFlags(row);
      this._cache.set(text, rowFlags);
    } else {
      grid.setRowFlags(row, rowFlags, FLAG_MASK_WIDTH | FLAG_MASK_LIGATURE);
    }
  }
}
