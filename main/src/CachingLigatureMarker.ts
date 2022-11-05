/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import lru from "lru-cache";

import { getLogger, Logger } from "extraterm-logging";
import { CharCellLine, FLAG_MASK_WIDTH, FLAG_MASK_LIGATURE } from "extraterm-char-cell-line";

export interface LigatureMarker {
    markLigaturesCharCellLine(line: CharCellLine, text: string): void;
}

interface PlainLigatureMarker {
  markLigaturesCharCellLine(line: CharCellLine): void;
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

  markLigaturesCharCellLine(line: CharCellLine, text: string): void {
    if (text == null) {
      this._marker.markLigaturesCharCellLine(line);
      return;
    }

    const rowFlags = this._cache.get(text);
    if (rowFlags == null) {
      this._marker.markLigaturesCharCellLine(line);
      const rowFlags = line.getRowFlags();
      this._cache.set(text, rowFlags);
    } else {
      line.setRowFlags(rowFlags, FLAG_MASK_WIDTH | FLAG_MASK_LIGATURE);
    }
  }
}
