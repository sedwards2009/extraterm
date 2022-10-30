/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import lru from "lru-cache";

import { getLogger, Logger } from "extraterm-logging";
import { CharCellLine, FLAG_MASK_WIDTH, FLAG_MASK_LIGATURE } from "extraterm-char-cell-grid";

export interface LigatureMarker {
    markLigaturesCharCellLine(grid: CharCellLine, row: number, text: string): void;
}

interface PlainLigatureMarker {
  markLigaturesCharCellGridRow(grid: CharCellLine, row: number): void;
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

  markLigaturesCharCellLine(grid: CharCellLine, row: number, text: string): void {
    if (text == null) {
      this._marker.markLigaturesCharCellGridRow(grid, row);
      return;
    }

    const rowFlags = this._cache.get(text);
    if (rowFlags == null) {
      this._marker.markLigaturesCharCellGridRow(grid, row);
      const rowFlags = grid.getRowFlags();
      this._cache.set(text, rowFlags);
    } else {
      grid.setRowFlags(rowFlags, FLAG_MASK_WIDTH | FLAG_MASK_LIGATURE);
    }
  }
}
