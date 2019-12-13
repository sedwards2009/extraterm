/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { CharCellGrid } from "extraterm-char-cell-grid";
import { stringToCodePointArray } from "extraterm-unicode-utilities";
import { ArrayKeyTrie } from "extraterm-array-key-trie";


/**
 * Class for detecting and marking ligatures in CharCellGrid objects.
 */
export class LigatureMarker {

  private _searchTreeRoot: ArrayKeyTrie<number, number>;

  constructor(ligatures: string[]) {
    this._searchTreeRoot = this._buildLigatureTree(ligatures);
  }

  private _buildLigatureTree(ligatures: string[]): ArrayKeyTrie<number, number> {
    const rootNode = new ArrayKeyTrie<number, number>();
    for (const str of ligatures) {
      const key = stringToCodePointArray(str);
      rootNode.insert(key, key.length);
    }
    return rootNode;
  }

  /**
   * Detect ligatures at the start of a string
   * 
   * @param codePoints the string ot search in
   * @return the length of the ligature in code points at the start of the string. 0 means no ligature.
   */
  getLigatureLength(codePoints: string | Uint32Array, index=0): number {
    const uint32CodePoints = typeof codePoints === "string" ? stringToCodePointArray(codePoints) : codePoints;

    const result = this._searchTreeRoot.getPrefix(uint32CodePoints, index);
    if (result.value == null) {
      return 0;
    }
    return result.value;
  }

  /**
   * Detect and mark the ligatures in CharCellGrid row
   * 
   * @param grid the grid to check and mark
   * @parm row the row scan from start to end
   */
  markLigatures(grid: CharCellGrid, row: number): void {
    const width = grid.width;
    const codePoints = grid.getRowCodePoints(row);
    for (let i=0; i<width; i++) {
      const ligatureLength = this.getLigatureLength(codePoints, i);
      grid.setLigature(i, row, ligatureLength);
      if (ligatureLength !== 0) {
        i += ligatureLength - 1;
      }
    }
  }
}
