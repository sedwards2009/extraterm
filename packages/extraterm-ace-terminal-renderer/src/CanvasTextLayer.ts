/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { TextLayer, EditSession, ViewPortSize } from "ace-ts";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { CharRenderCanvas, xtermPalette } from "extraterm-char-render-canvas";
import { LayerConfig } from "ace-ts/build/layer/LayerConfig";
import { TerminalCanvasEditSession } from "./TerminalCanvasEditSession";
import { Logger, getLogger, log } from "extraterm-logging";

export class CanvasTextLayer implements TextLayer {

  element: HTMLDivElement;

  private _charRenderCanvas: CharRenderCanvas = null;
  private _editSession: TerminalCanvasEditSession = null;
  private _config: LayerConfig = null;
  private _log: Logger = null;

  private _palette: number[] = null;
  private _fontFamily: string = null;
  private _fontSizePx: number = 0;

  constructor(private readonly _contentDiv: HTMLDivElement, palette: number[], fontFamily: string, fontSizePx: number) {
    this._log = getLogger("CanvasTextLayer", this);
    this._palette = palette == null ? this._fallbackPalette() : palette;

    this._fontFamily = fontFamily;
    this._fontSizePx = fontSizePx; 
  }

  private _fallbackPalette(): number[] {
    const result = [];
    // Very simple white on black palette.
    result[0] = 0x00000000;
    for (let i=1; i<256; i++) {
      result[i] = 0xffffffff;
    }
    result[256] = 0x00000000;
    result[257] = 0xf0f0f0ff;
    result[258] = 0xffaa00ff;
    return result;
  }

  setPalette(palette: number[]): void {
    this._palette = palette;

    if (this._charRenderCanvas == null) {
      return;
    }
    this._charRenderCanvas.setPalette(palette);
  }

  setFontFamily(fontFamily: string): void {
    this._fontFamily = fontFamily;
  }

  setFontSizePx(fontSizePx: number): void {
    this._fontSizePx = fontSizePx;
  }

  dispose(): void {
  }

  setEolChar(eolChar: string): void {
  }

  setSession(session: EditSession): void {
    this._editSession = <TerminalCanvasEditSession> session;
  }

  getShowInvisibles(): boolean {
    return false;
  }

  setShowInvisibles(showInvisibles: boolean): boolean {
    return false;
  }

  getDisplayIndentGuides(): boolean {
    return false;
  }

  setDisplayIndentGuides(displayIndentGuides: boolean): boolean {
    return false;
  }

  onChangeTabSize(): void {
  }

  updateRows(config: LayerConfig, viewPortSize: ViewPortSize, firstRow: number, lastRow: number): void {
    this.update(config, viewPortSize);
  }

  scrollRows(config: LayerConfig, viewPortSize: ViewPortSize): void {
    this.update(config, viewPortSize);
  }

  update(config: LayerConfig, viewPortSize: ViewPortSize): void {
    this._config = config;

    const visibleRows = this._getVisibleRows(config);
    this._setUpRenderCanvas(config, viewPortSize, visibleRows.length);

    this._writeLinesToGrid(this._charRenderCanvas.getCellGrid(), visibleRows, 0);
    this._charRenderCanvas.render();
  }

  private _setUpRenderCanvas(config: LayerConfig, viewPortSize: ViewPortSize, numOfVisibleRows: number): void {
    const canvasWidth = viewPortSize.widthPx;
    const canvasHeight = numOfVisibleRows * config.charHeightPx;

    if (this._charRenderCanvas != null) {
      if (this._charRenderCanvas.getWidthPx() === canvasWidth &&
          this._charRenderCanvas.getHeightPx() === canvasHeight) {
        return;
      }

      const canvasElement = this._charRenderCanvas.getCanvasElement();
      canvasElement.parentElement.removeChild(canvasElement);
      this._charRenderCanvas = null;
    }

    this._charRenderCanvas = new CharRenderCanvas({
      fontFamily: this._fontFamily,
      fontSizePx: this._fontSizePx,
      palette: this._palette,
      widthPx: canvasWidth,
      heightPx: canvasHeight
    });

    this._contentDiv.appendChild(this._charRenderCanvas.getCanvasElement());
  }

  private _writeLinesToGrid(grid: CharCellGrid, rows: number[], canvasStartRow: number): void {
    let canvasRow = canvasStartRow;
    for (const docRow of rows) {
      const terminalLine = this._editSession.getTerminalLine(docRow);
      grid.pasteGrid(terminalLine, 0, canvasRow);
      canvasRow++;
    }
  }

  private _getVisibleRows(config: LayerConfig): number[] {
    const firstRow = config.firstRow;
    const lastRow = config.lastRow;

    let row = firstRow;
    let foldLine = this._editSession.getNextFoldLine(row);
    let foldStart = foldLine ? foldLine.start.row : Infinity;

    const visibleRows: number[] = [];
    while (true) {
        if (row > foldStart) {
            if (foldLine) {
                row = foldLine.end.row + 1;
                foldLine = this._editSession.getNextFoldLine(row, foldLine);
                foldStart = foldLine ? foldLine.start.row : Infinity;
            }
        }
        if (row > lastRow) {
            break;
        }

        visibleRows.push(row);
        row++;
    }
    return visibleRows;
  }

}
