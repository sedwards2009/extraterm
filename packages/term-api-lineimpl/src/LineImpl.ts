/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { Line } from 'term-api';
import { CharCellGrid, Cell } from 'extraterm-char-cell-grid';

export interface CellWithHyperlink extends Cell {
  hyperlinkID: string;
  hyperlinkURL: string;
}

/**
 * An implementation of Term API's `Line`
 * 
 * This adds better support for hyperlinks and associating URLs with the link
 * ID attributes on cells.
 */
export class LineImpl extends CharCellGrid implements Line {

  wrapped = false;

  private _hyperlinkIDCounter = 0;
  private _hyperlinkIDToURLMapping: Map<number, string> = null;
  private _hyperlinkURLToIDMapping: Map<string, number> = null;

  constructor(width: number, height: number, palette: number[]=null, __bare__=false) {
    super(width, height, palette, __bare__);
  }

  hasLinks(): boolean {
    return this._hyperlinkIDToURLMapping != null;
  }

  getLinkURLByID(linkID: number): string {
    if (this._hyperlinkIDToURLMapping == null) {
      return null;
    }
    return this._hyperlinkIDToURLMapping.get(linkID);
  }

  getLinkIDByURL(url: string): number {
    if (this._hyperlinkIDToURLMapping == null) {
      return 0;
    }
    if (this._hyperlinkURLToIDMapping.has(url)) {
      return this._hyperlinkURLToIDMapping.get(url);
    }
    return 0;
  }

  getOrCreateLinkIDForURL(url: string): number {
    if (this._hyperlinkIDToURLMapping == null) {
      this._hyperlinkIDToURLMapping = new Map<number, string>();
      this._hyperlinkURLToIDMapping = new Map<string, number>();
    }

    if ( ! this._hyperlinkURLToIDMapping.has(url)) {
      if (this._hyperlinkIDCounter === 255) {
        this._compactLinkIDs();
      }
      if (this._hyperlinkIDCounter === 255) {
        return 0;
      }

      this._hyperlinkIDCounter++;
      const linkID = this._hyperlinkIDCounter;
      this._hyperlinkURLToIDMapping.set(url, linkID);
      this._hyperlinkIDToURLMapping.set(linkID, url);
      return linkID;
    } else {
      return this._hyperlinkURLToIDMapping.get(url);
    }
  }

  private _compactLinkIDs(): void {
    const width = this.width;
    const height = this.height;

    const oldLinkIDMapping = this._hyperlinkIDToURLMapping;

    this._hyperlinkIDCounter = 0;
    this._hyperlinkIDToURLMapping = new Map<number, string>();
    this._hyperlinkURLToIDMapping = new Map<string, number>();

    for (let y=0; y<height; y++) {
      for (let x=0; x<width; x++) {
        const linkID = this.getLinkID(x, y);
        if (linkID !== 0) {
          const url = oldLinkIDMapping.get(linkID);
          const newLinkID = this.getOrCreateLinkIDForURL(url);
          this.setLinkID(x, y, newLinkID);
        }
      }
    }
  }

  getAllLinkIDs(): number[] {
    if (this._hyperlinkIDToURLMapping == null) {
      return [];
    }
    return Array.from(this._hyperlinkIDToURLMapping.keys());
  }

  setCellAndLink(x: number, y: number, cellAttr: CellWithHyperlink): void {
    const hyperlinkURL = cellAttr.hyperlinkURL;
    if (hyperlinkURL != null) {
      cellAttr.linkID = this.getOrCreateLinkIDForURL(hyperlinkURL);
    } else {
      cellAttr.linkID = 0;
    }
    this.setCell(x, y, cellAttr);
  }

  getCellAndLink(x: number, y: number): CellWithHyperlink {
    const cellAttrs = this.getCell(x, y);
    let hyperlinkURL: string = null;
    const hyperlinkID: string = null; // FIXME needed??

    if (cellAttrs.linkID !== 0) {
      hyperlinkURL = this._hyperlinkIDToURLMapping.get(cellAttrs.linkID);
    }

    return {hyperlinkURL, hyperlinkID, ...cellAttrs};
  }

  clone(): Line {
    const grid = new LineImpl(this.width, this.height, this.palette);
    this.cloneInto(grid);

    if (this._hyperlinkIDToURLMapping != null) {
      grid._hyperlinkIDCounter = this._hyperlinkIDCounter;
      grid._hyperlinkIDToURLMapping = new Map(this._hyperlinkIDToURLMapping);
      grid._hyperlinkURLToIDMapping = new Map(this._hyperlinkURLToIDMapping);
    }

    return grid;
  }

  clear(): void {
    super.clear();
    this._hyperlinkIDCounter = 0;
    this._hyperlinkIDToURLMapping = null;
    this._hyperlinkURLToIDMapping = null;
  }

  pasteGridWithLinks(sourceGrid: Line, x: number, y: number): void {
    super.pasteGrid(sourceGrid, x, y);

    if ( ! sourceGrid.hasLinks()) {
      return;
    }

    const endY = Math.min(y+sourceGrid.height, this.height);
    const endH = Math.min(x+sourceGrid.width, this.width);

    const sx = x < 0 ? -x : 0;
    x = Math.max(x, 0);
    let sv = y < 0 ? -y : 0;
    y = Math.max(y, 0);
// console.log(`x: ${x}, y: ${y}, endY: ${endY}, endH: ${endH}, sx: ${sx}, sv: ${sv}`);
    for (let v=y; v<endY; v++, sv++) {
      for (let h=x; h<endH; h++) {
// console.log(`getLinkID(${h+sx}, ${sv})`);
        const sourceLinkID = sourceGrid.getLinkID(h+sx, sv);
        if (sourceLinkID !== 0) {
          const url = sourceGrid.getLinkURLByID(sourceLinkID);
          const newLinkID = this.getOrCreateLinkIDForURL(url);
// console.log(`setLinkID(${h+x}, ${v+y})`);
          this.setLinkID(h, v, newLinkID);
        }
      }
    }
  }
}
