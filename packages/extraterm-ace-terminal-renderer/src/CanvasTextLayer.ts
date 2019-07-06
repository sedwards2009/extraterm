/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { TextLayer, EditSession, ViewPortSize } from "ace-ts";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { CharRenderCanvas, FontAtlasRepository } from "extraterm-char-render-canvas";
import { LayerConfig } from "ace-ts/build/layer/LayerConfig";
import { TerminalCanvasEditSession } from "./TerminalCanvasEditSession";
import { Logger, getLogger, log } from "extraterm-logging";
import { ratioToFraction } from "./RatioToFraction";

const PROVISION_HEIGHT_FACTOR = 1.5;

const fontAtlasRepository = new FontAtlasRepository();


export class CanvasTextLayer implements TextLayer {

  element: HTMLDivElement;

  private _charRenderCanvas: CharRenderCanvas = null;
  private _canvasWidthCssPx = 0;
  private _canvasHeightCssPx = 0;
  
  private _editSession: TerminalCanvasEditSession = null;


  private _lastConfig: LayerConfig = null;
  private _log: Logger = null;

  private _palette: number[] = null;
  private _fontFamily: string = null;
  private _fontSizePx: number = 0;
  private _devicePixelRatio = 1;

  private _clipDiv: HTMLDivElement = null;

  constructor(private readonly _contentDiv: HTMLDivElement, palette: number[], fontFamily: string, fontSizePx: number,
              devicePixelRatio: number) {

    this._log = getLogger("CanvasTextLayer", this);
    this._palette = palette == null ? this._fallbackPalette() : palette;

    this._fontFamily = fontFamily;
    this._fontSizePx = fontSizePx; 
    this._devicePixelRatio = devicePixelRatio;

    this._clipDiv = <HTMLDivElement> document.createElement("DIV");
    this._clipDiv.style.overflow = "hidden";

    this._contentDiv.appendChild(this._clipDiv);
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
    this._deleteCanvasElement();
  }

  setFontSizePx(fontSizePx: number): void {
    this._fontSizePx = fontSizePx;
    this._deleteCanvasElement();
  }

  setDevicePixelRatio(devicePixelRatio: number): void {
    this._devicePixelRatio = devicePixelRatio;
    this._deleteCanvasElement();
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
    if (Math.abs(config.firstRow - this._lastConfig.firstRow) < this._charRenderCanvas.getCellGrid().height) {
      // Scroll the existing contents      
      this._charRenderCanvas.scrollVertical(config.firstRow - this._lastConfig.firstRow);
    }

    this.update(config, viewPortSize);
  }

  update(config: LayerConfig, viewPortSize: ViewPortSize): void {
    this._lastConfig = config;

    const visibleRows = this._getVisibleRows(config);
    this._setUpRenderCanvas(config, viewPortSize, visibleRows.length);

    this._writeLinesToGrid(this._charRenderCanvas.getCellGrid(), visibleRows);
    this._charRenderCanvas.render();
  }

  private _setUpRenderCanvas(config: LayerConfig, viewPortSize: ViewPortSize, numOfVisibleRows: number): void {
    const rawCanvasWidthPx = viewPortSize.widthPx;
    const rawCanvasHeightPx = Math.ceil(numOfVisibleRows * config.charHeightPx);

    if (this._charRenderCanvas != null) {
      this._setupClipping(rawCanvasWidthPx, rawCanvasHeightPx);

      if (this._canvasWidthCssPx >= rawCanvasWidthPx &&
          this._canvasHeightCssPx >= rawCanvasHeightPx) {
        return;
      }
      this._deleteCanvasElement();
    }

    // Over-provision
    const provisionCanvasHeight = Math.ceil((Math.round(numOfVisibleRows * PROVISION_HEIGHT_FACTOR) + 1)
                                    * config.charHeightPx);
    this._createCanvas(rawCanvasWidthPx, provisionCanvasHeight);
    this._setupClipping(rawCanvasWidthPx, rawCanvasHeightPx);
  }

  private _createCanvas(rawWidthPx: number, rawHeightPx: number): void {
    const widthPxPair = this._computeDevicePixelRatioPair(this._devicePixelRatio, rawWidthPx);
    const heightPxPair = this._computeDevicePixelRatioPair(this._devicePixelRatio, rawHeightPx);

    const canvasWidthPx = widthPxPair.screenLength;
    const canvasHeightPx = heightPxPair.screenLength;

    this._canvasWidthCssPx = rawWidthPx;
    this._canvasHeightCssPx = rawHeightPx;
    this._charRenderCanvas = new CharRenderCanvas({
      fontFamily: this._fontFamily,
      fontSizePx: this._fontSizePx * this._devicePixelRatio,
      palette: this._palette,
      widthPx: widthPxPair.renderLength,
      heightPx: heightPxPair.renderLength,
      usableWidthPx: rawWidthPx * this._devicePixelRatio,
      usableHeightPx: rawHeightPx * this._devicePixelRatio,
      fontAtlasRepository,
      extraFonts: [{
        fontFamily: "emojione",
        fontSizePx: this._fontSizePx * this._devicePixelRatio,
        unicodeStart: 0x1f000,
        unicodeEnd: 0x20000,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }]
    });

    const canvasElement = this._charRenderCanvas.getCanvasElement();
    canvasElement.style.width = "" + canvasWidthPx + "px";
    canvasElement.style.height = "" + canvasHeightPx + "px";

    this._clipDiv.appendChild(canvasElement);
  }

  private _setupClipping(rawWidthPx: number, rawHeightPx: number): void {
    this._clipDiv.style.width = "" + rawWidthPx + "px";
    this._clipDiv.style.height = "" + rawHeightPx + "px";
  }

  private _deleteCanvasElement(): void {
    if (this._charRenderCanvas == null) {
      return;
    }
    const canvasElement = this._charRenderCanvas.getCanvasElement();
    canvasElement.parentElement.removeChild(canvasElement);
    this._charRenderCanvas = null;
  }

  private _computeDevicePixelRatioPair(devicePixelRatio: number, length: number): { screenLength: number, renderLength: number } {
    // Compute two lengths, `screenLength` and `renderLength` such that renderLength/screenLength = devicePixelRatio
    // screenLength should be close, but not small than the length parameter.
    if (devicePixelRatio === 1) {
      return {
        screenLength: length,
        renderLength: length
      };
    }

    // We are looking for two integers, i & j, such that i/j = devicePixelRatio
    // i & j should be a small as possible.
    const [renderMultiple, screenMultiple] = ratioToFraction(devicePixelRatio);
    const screenLength = Math.ceil(length / screenMultiple) * screenMultiple;
    const renderLength = screenLength / screenMultiple * renderMultiple;
    return {
      screenLength,
      renderLength
    };
  }

  private _writeLinesToGrid(grid: CharCellGrid, rows: number[]): void {
    let canvasRow = 0;
    for (const docRow of rows) {
      const terminalLine = this._editSession.getTerminalLine(docRow);
      if (terminalLine != null) {
        grid.pasteGrid(terminalLine, 0, canvasRow);

        if (terminalLine.width < grid.width) {
          for (let i = terminalLine.width; i < grid.width; i++) {
            grid.clearCell(i, canvasRow);
          }
        }
      } else {
        // Just clear the row
        for (let i = 0; i < grid.width; i++) {
          grid.clearCell(i, canvasRow);
        }
      }
      canvasRow++;

      if (canvasRow >= grid.height) {
        break;
      }
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

        visibleRows.push(row);

        if (row > lastRow) {
            break;
        }

        row++;
    }
    return visibleRows;
  }
}
