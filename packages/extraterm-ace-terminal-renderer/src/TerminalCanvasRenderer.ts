/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, HScrollTracking, VScrollBar, TextLayer, FontMetricsMonitor, FontMetrics } from "ace-ts";
import { CanvasTextLayer } from "./CanvasTextLayer";
import { computeFontMetrics } from "extraterm-char-render-canvas";
import { Event } from 'extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

export interface TerminalCanvasRendererOptions {
  palette: number[];
  fontFamily: string;
  fontSizePx: number;
}

export class TerminalCanvasRenderer extends Renderer {
  private _log: Logger = null;
  private _canvasTextLayer: CanvasTextLayer;
  private _palette: number[] = null;
  private _fontFamily: string = null;
  private _fontSizePx: number = null;
  private _canvasFontMetricsMonitor: CanvasFontMetricsMonitor = null;

  constructor(container: HTMLElement, options: TerminalCanvasRendererOptions) {
    super(container, { injectCss: false, fontSize: null });
    this._log = getLogger("TerminalCanvasRenderer", this);

    this.setPalette(options.palette);
    this.setFontFamily(options.fontFamily);
    this.setFontSizePx(options.fontSizePx);
    this.setHScrollTracking(HScrollTracking.VISIBLE);
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return new HiddenVScrollBar(container, this);
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
      return new InsetHScrollBar(container, this);
  }

  protected createTextLayer(contentDiv: HTMLDivElement): TextLayer {
    this._canvasTextLayer = new CanvasTextLayer(contentDiv, this._palette, this._fontFamily, this._fontSizePx);
    return this._canvasTextLayer;
  }
  
  protected createFontMetricsMonitor(): FontMetricsMonitor {
    this._canvasFontMetricsMonitor = new CanvasFontMetricsMonitor(this._fontFamily, this._fontSizePx);
    return this._canvasFontMetricsMonitor;
  }

  setPalette(palette: number[]): void {
    this._palette = palette;
    if (this._canvasTextLayer == null) {
      return;
    }
    this._canvasTextLayer.setPalette(palette);
  }

  setFontFamily(fontFamily: string): void {
    this._fontFamily = fontFamily;
    if (this._canvasTextLayer == null) {
      return;
    }
    this._canvasTextLayer.setFontFamily(fontFamily);

    if (this._canvasFontMetricsMonitor == null) {
      return;
    }
    this._canvasFontMetricsMonitor.setFontFamily(fontFamily);
  }

  setFontSizePx(fontSizePx: number): void {
    this._fontSizePx = fontSizePx;
    if (this._canvasTextLayer == null) {
      return;
    }
    this._canvasTextLayer.setFontSizePx(fontSizePx);

    if (this._canvasFontMetricsMonitor == null) {
      return;
    }
    this._canvasFontMetricsMonitor.setFontSizePx(fontSizePx);
  }
}

class HiddenVScrollBar extends VScrollBar {
  setVisible(isVisible: boolean): this {
    if (isVisible === false) {
      super.setVisible(false);    // Stop the scrollbar from ever being visible.
    }
    return this;
  }
}

class InsetHScrollBar extends HScrollBar {

  constructor(parent: HTMLElement, renderer: Renderer) {
    super(parent, renderer);

    this.inner.style.removeProperty("height");
    this.element.style.removeProperty("height");
  }

  get height(): number {
    return 0;
  }
}

class CanvasFontMetricsMonitor implements FontMetricsMonitor {
  private _log: Logger = null;
  private _onChangeEventEmitter = new EventEmitter<FontMetrics>();
  onChange: Event<FontMetrics>;
  private _fontMetrics: FontMetrics = null;
  private _isMonitoring = false;

  constructor(private _fontFamily: string, private _fontSizePx: number) {
    this._log = getLogger("CanvasFontMetricsMonitor", this);

    this._log.debug(`fontFamily: ${this._fontFamily}, fontSizePx: ${this._fontSizePx}`);
    this.onChange = this._onChangeEventEmitter.event;
  }

  getFontMetrics(): FontMetrics {
    if (this._fontMetrics != null) {
      return this._fontMetrics;
    }

    const monoMetrics = computeFontMetrics(this._fontFamily, this._fontSizePx);
    this._fontMetrics = {
      charWidthPx: monoMetrics.widthPx,
      charHeightPx: monoMetrics.heightPx,
      isBoldCompatible: true
    };
    return this._fontMetrics;
  }

  checkForSizeChanges(): void {
  }

  startMonitoring(): void {
    this._isMonitoring = true;
  }

  dispose(): void {
  }

  setFontFamily(fontFamily: string): void {

  }

  setFontSizePx(fontSizePx: number): void {

  }

}
