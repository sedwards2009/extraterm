/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, HScrollTracking, VScrollBar, TextLayer, FontMetricsMonitor, FontMetrics } from "ace-ts";
import { CanvasTextLayer } from "./CanvasTextLayer";
import { computeDpiFontMetrics } from "extraterm-char-render-canvas";
import { Event } from 'extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";
import { CursorStyle } from "extraterm-char-render-canvas";
export { CursorStyle } from "extraterm-char-render-canvas";


export interface TerminalCanvasRendererConfig {
  cursorStyle: CursorStyle;
  palette: number[];
  devicePixelRatio: number;
  fontFamily: string;
  fontSizePx: number;
}

export class TerminalCanvasRenderer extends Renderer {
  private _log: Logger = null;
  private _canvasTextLayer: CanvasTextLayer;
  private _terminalCanvasRendererConfig: TerminalCanvasRendererConfig = null;
  private _canvasFontMetricsMonitor: CanvasFontMetricsMonitor = null;

  constructor(container: HTMLElement, terminalCanvasRendererConfig: TerminalCanvasRendererConfig) {
    super(container, { injectCss: false, fontSize: null });
    this._log = getLogger("TerminalCanvasRenderer", this);

    this.setTerminalCanvasRendererConfig(terminalCanvasRendererConfig);
    this.setHScrollTracking(HScrollTracking.VISIBLE);
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return new HiddenVScrollBar(container, this);
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
    return new InsetHScrollBar(container, this);
  }

  protected createTextLayer(contentDiv: HTMLDivElement): TextLayer {
    this._canvasTextLayer = new CanvasTextLayer(contentDiv, this._terminalCanvasRendererConfig.palette,
      this._terminalCanvasRendererConfig.fontFamily, this._terminalCanvasRendererConfig.fontSizePx,
      this._terminalCanvasRendererConfig.devicePixelRatio, this._terminalCanvasRendererConfig.cursorStyle);
    return this._canvasTextLayer;
  }
  
  protected createFontMetricsMonitor(): FontMetricsMonitor {
    this._canvasFontMetricsMonitor = new CanvasFontMetricsMonitor(this._terminalCanvasRendererConfig);
    return this._canvasFontMetricsMonitor;
  }

  setTerminalCanvasRendererConfig(terminalCanvasRendererConfig: TerminalCanvasRendererConfig): void {
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.setCursorStyle(terminalCanvasRendererConfig.cursorStyle);
      this._canvasTextLayer.setPalette(terminalCanvasRendererConfig.palette);
      this._canvasTextLayer.setFontFamily(terminalCanvasRendererConfig.fontFamily);
      this._canvasTextLayer.setFontSizePx(terminalCanvasRendererConfig.fontSizePx);
      this._canvasTextLayer.setDevicePixelRatio(terminalCanvasRendererConfig.devicePixelRatio);
    }
    if (this._canvasFontMetricsMonitor != null) {
      this._canvasFontMetricsMonitor.setTerminalCanvasRendererConfig(terminalCanvasRendererConfig);
    }
    this.rerenderText();
  }
  
  setRenderCursorStyle(cursorStyle: CursorStyle): void {
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.setCursorStyle(cursorStyle);
    }
  }

  reduceMemory(): void {
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.reduceMemory();
    }
  }

  rerenderText(): void {
    if (this._canvasTextLayer != null) {
      this._canvasTextLayer.rerender();
    }
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
  private _terminalCanvasRendererConfig: TerminalCanvasRendererConfig = null;
  private _onChangeEventEmitter = new EventEmitter<FontMetrics>();
  onChange: Event<FontMetrics>;
  private _fontMetrics: FontMetrics = null;

  constructor(terminalCanvasRendererConfig: TerminalCanvasRendererConfig) {
    this._log = getLogger("CanvasFontMetricsMonitor", this);
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;

    // this._log.debug(`fontFamily: ${this._fontFamily}, fontSizePx: ${this._fontSizePx}, devicePixelRatio: ${this._devicePixelRatio}`);
    this.onChange = this._onChangeEventEmitter.event;
  }

  getFontMetrics(): FontMetrics {
    if (this._fontMetrics != null) {
      return this._fontMetrics;
    }
    this._fontMetrics = this._computeAceFontMetrics();
    return this._fontMetrics;
  }

  private _computeAceFontMetrics(): FontMetrics {
    const { renderFontMetrics, cssFontMetrics } = computeDpiFontMetrics(this._terminalCanvasRendererConfig.fontFamily,
      this._terminalCanvasRendererConfig.fontSizePx, this._terminalCanvasRendererConfig.devicePixelRatio);
    const fontMetrics = {
      charWidthPx: cssFontMetrics.widthPx,
      charHeightPx: cssFontMetrics.heightPx,
      isBoldCompatible: true
    };
    return fontMetrics;
  }

  checkForSizeChanges(): void {
    const newMetrics = this._computeAceFontMetrics();
    if (this._fontMetrics != null) {
      if (this._fontMetrics.charHeightPx === newMetrics.charHeightPx &&
        this._fontMetrics.charWidthPx === newMetrics.charWidthPx &&
        this._fontMetrics.isBoldCompatible === newMetrics.isBoldCompatible) {
          return;
        }
    }
    this._fontMetrics = newMetrics;
    this._onChangeEventEmitter.fire(newMetrics);
  }

  startMonitoring(): void {
  }

  dispose(): void {
  }

  setTerminalCanvasRendererConfig(terminalCanvasRendererConfig: TerminalCanvasRendererConfig): void {
    this._terminalCanvasRendererConfig = terminalCanvasRendererConfig;
    this.checkForSizeChanges();
  }
}
