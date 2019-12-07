/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { CharCellGrid } from "extraterm-char-cell-grid";
import { stringToCodePointArray } from "extraterm-unicode-utilities";


interface SearchTreeNode {
  isTerminal: boolean;
  branch: Map<number, SearchTreeNode | null>;
}

/**
 * Class for detecting and marking ligatures in CharCellGrid objects.
 */
export class LigatureMarker {

  private _searchTreeRoot: SearchTreeNode;

  constructor(ligatures: string[]) {
    this._searchTreeRoot = this._buildLigatureTree(ligatures);
  }

  private _buildLigatureTree(ligatures: string[]): SearchTreeNode {
    const rootNode: SearchTreeNode = {
      branch: new Map<number, SearchTreeNode>(),
      isTerminal: false
    };
    for (const str of ligatures) {
      this._insertIntoTree(0, stringToCodePointArray(str), rootNode);
    }
    return rootNode;
  }

  private _insertIntoTree(index: number, codePoints: Uint32Array, searchTreeNode: SearchTreeNode): void {
    if (index === codePoints.length) {
      searchTreeNode.isTerminal = true;
      return;
    }

    const codePoint = codePoints[index];
    if ( ! searchTreeNode.branch.has(codePoint)) {
      const newNode: SearchTreeNode = {
        branch: new Map<number, SearchTreeNode>(),
        isTerminal: false
      };
      searchTreeNode.branch.set(codePoint, newNode);
    }

    this._insertIntoTree(index+1, codePoints, searchTreeNode.branch.get(codePoint));
  }

  /**
   * Detect ligatures at the start of a string
   * 
   * @param codePoints the string ot search in
   * @return the length of the ligature in code points at the start of the string. 0 means no ligature.
   */
  getLigatureLength(codePoints: string | Uint32Array, index=0): number {
    const uint32CodePoints = typeof codePoints === "string" ? stringToCodePointArray(codePoints) : codePoints;
    return this._getLigatureLength(index, uint32CodePoints, this._searchTreeRoot, 0);
  }

  private _getLigatureLength(index: number, codePoints: Uint32Array, searchTreeNode: SearchTreeNode, accu: number): number {
    if (index >= codePoints.length) {
      return 0;
    }
    const codePoint = codePoints[index];
    const node = searchTreeNode.branch.get(codePoint);
    if (node == null) {
      return 0;
    }
    if (node.isTerminal) {
      return accu+1;
    }

    return this._getLigatureLength(index+1, codePoints, node, accu+1);
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
