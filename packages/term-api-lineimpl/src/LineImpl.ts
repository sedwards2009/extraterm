/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { Line } from "term-api";
import { PairKeyMap } from "extraterm-data-structures";
import { isWide, utf16LengthOfCodePoint } from "extraterm-unicode-utilities";
import { CharCellGrid, Cell } from "extraterm-char-cell-grid";

export interface CellWithHyperlink extends Cell {
  hyperlinkID: string;
  hyperlinkURL: string;
}

interface URLGroupPair {
  group: string;
  url: string;
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
  private _hyperlinkIDToURLMapping: Map<number, URLGroupPair> = null;
  private _hyperlinkURLToIDMapping: PairKeyMap<string, string, number> = null;
  #cachedString: string = null;

  constructor(width: number, height: number, palette: number[]=null, __bare__=false) {
    super(width, height, palette, __bare__);
  }

  hasLinks(): boolean {
    return this._hyperlinkIDToURLMapping != null;
  }

  getLinkURLByID(linkID: number): { url: string, group: string} {
    if (this._hyperlinkIDToURLMapping == null) {
      return null;
    }
    return this._hyperlinkIDToURLMapping.get(linkID);
  }

  getLinkIDByURL(url: string, group: string=""): number {
    if (this._hyperlinkIDToURLMapping == null) {
      return 0;
    }
    const id = this._hyperlinkURLToIDMapping.get(group, url);
    if (id === undefined) {
      return 0;
    }
    return id;
  }

  getOrCreateLinkIDForURL(url: string, group: string=""): number {
    if (this._hyperlinkIDToURLMapping == null) {
      this._hyperlinkIDToURLMapping = new Map<number, URLGroupPair>();
      this._hyperlinkURLToIDMapping = new PairKeyMap<string, string, number>();
    }

    if ( ! this._hyperlinkURLToIDMapping.has(group, url)) {
      if (this._hyperlinkIDCounter === 255) {
        this._compactLinkIDs();
      }
      if (this._hyperlinkIDCounter === 255) {
        return 0;
      }

      this._hyperlinkIDCounter++;
      const linkID = this._hyperlinkIDCounter;
      this._hyperlinkURLToIDMapping.set(group, url, linkID);
      this._hyperlinkIDToURLMapping.set(linkID, {url, group});
      return linkID;
    } else {
      return this._hyperlinkURLToIDMapping.get(group, url);
    }
  }

  private _compactLinkIDs(): void {
    const width = this.width;
    const height = this.height;

    const oldLinkIDMapping = this._hyperlinkIDToURLMapping;

    this._hyperlinkIDCounter = 0;
    this._hyperlinkIDToURLMapping = new Map<number, URLGroupPair>();
    this._hyperlinkURLToIDMapping = new PairKeyMap<string, string, number>();

    for (let y=0; y<height; y++) {
      for (let x=0; x<width; x++) {
        const linkID = this.getLinkID(x, y);
        if (linkID !== 0) {
          const urlGroup = oldLinkIDMapping.get(linkID);
          const newLinkID = this.getOrCreateLinkIDForURL(urlGroup.url, urlGroup.group);
          this.setLinkID(x, y, newLinkID);
        }
      }
    }
  }

  getAllLinkIDs(group: string=""): number[] {
    if (this._hyperlinkIDToURLMapping == null) {
      return [];
    }
    if (group === "") {
      return Array.from(this._hyperlinkIDToURLMapping.keys());
    }
    return Array.from(this._hyperlinkURLToIDMapping.level1Values(group));
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
    let hyperlinkURLGroupPair: URLGroupPair = null;
    const hyperlinkID: string = null; // FIXME needed??

    if (cellAttrs.linkID !== 0) {
      hyperlinkURLGroupPair = this._hyperlinkIDToURLMapping.get(cellAttrs.linkID);
    }

    return {hyperlinkURL: hyperlinkURLGroupPair.url, hyperlinkID, ...cellAttrs};
  }

  clone(): Line {
    const grid = new LineImpl(this.width, this.height, this.palette);
    this.cloneInto(grid);

    if (this._hyperlinkIDToURLMapping != null) {
      grid._hyperlinkIDCounter = this._hyperlinkIDCounter;
      grid._hyperlinkIDToURLMapping = new Map(this._hyperlinkIDToURLMapping);
      grid._hyperlinkURLToIDMapping = this._hyperlinkURLToIDMapping.copy();
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
    for (let v=y; v<endY; v++, sv++) {
      for (let h=x; h<endH; h++) {
        const sourceLinkID = sourceGrid.getLinkID(h+sx, sv);
        if (sourceLinkID !== 0) {
          const urlGroup = sourceGrid.getLinkURLByID(sourceLinkID);
          const newLinkID = this.getOrCreateLinkIDForURL(urlGroup.url, urlGroup.group);
          this.setLinkID(h, v, newLinkID);
        }
      }
    }
  }

  mapStringIndexToColumn(line: number, x: number): number {
    let c = 0;
    let i = 0;
    const width = this.width;
    while (i < x && i < width) {
      const codePoint = this.getCodePoint(i ,line);
      i += utf16LengthOfCodePoint(codePoint);
      c += isWide(codePoint) ? 2 : 1;
    }
    return c;
  }

  // See `CharCellGrid.getString()`. This version though properly handles
  // full width characters.
  getString(x: number, y: number, count?: number): string {
    if (x ===0 && y === 0 && count === undefined) {
      return this._cachingGetLineString();
    } else {
      return this._generalGetString(x, y, count);
    }
  }

  private _cachingGetLineString(): string {
    if (this.isDirtyFlag()) {
      this.#cachedString = this._generalGetString(0, 0);
      this.clearDirtyFlag();
    }
    return this.#cachedString;
  }

  private _generalGetString(x: number, y: number, count?: number): string {
    const codePoints: number[] = [];
    const spaceCodePoint = " ".codePointAt(0);
    const lastX = x + (count == null ? this.width : Math.min(this.width, count));

    let isLastWide = false;
    for (let i=x; i<lastX; i++) {
      const codePoint = this.getCodePoint(i, y);
      if (codePoint === spaceCodePoint && isLastWide) {
        isLastWide = false;
        continue;
      }
      codePoints.push(codePoint);
      isLastWide = isWide(codePoint);
    }
    return String.fromCodePoint(...codePoints);
  }

  // See `CharCellGrid.getUTF16StringLength()`. This version though properly
  // handles full width characters.
  getUTF16StringLength(x: number, y: number, count?: number): number {
    const spaceCodePoint = " ".codePointAt(0);
    const lastX = x + (count == null ? this.width : Math.min(this.width, count));
    let size = 0;
    let isLastWide = false;
    for (let i=x; i<lastX; i++) {
      const codePoint = this.getCodePoint(i, y);
      if (codePoint === spaceCodePoint && isLastWide) {
        isLastWide = false;
        continue;
      }
      isLastWide = isWide(codePoint);
      size += utf16LengthOfCodePoint(codePoint);
    }
    return size;
  }
}
