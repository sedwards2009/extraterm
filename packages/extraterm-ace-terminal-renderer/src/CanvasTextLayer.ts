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

  constructor(private readonly _contentDiv: HTMLDivElement) {
    this._log = getLogger("CanvasTextLayer", this);
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
      fontFamily: "DejaVuSansMono",   // TODO
      fontSizePx: 13,                 // TODO
      palette: xtermPalette(),        // TODO
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
