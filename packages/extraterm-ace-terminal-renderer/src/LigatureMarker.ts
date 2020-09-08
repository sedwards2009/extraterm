/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { CharCellGrid } from "extraterm-char-cell-grid";


export interface LigatureMarker {
  markLigaturesCharCellGridRow(grid: CharCellGrid, row: number, text: string): void;
}
