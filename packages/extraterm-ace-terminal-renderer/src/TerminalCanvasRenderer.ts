/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, HScrollTracking, VScrollBar, TextLayer } from "ace-ts";
import { CanvasTextLayer } from "./CanvasTextLayer";


export class TerminalCanvasRenderer extends Renderer {

  private _canvasTextLayer: CanvasTextLayer;
  private _palette: number[] = null;

  constructor(container: HTMLElement, palette: number[]) {
    super(container, { injectCss: false, fontSize: null });
    this.setPalette(palette);
    this.setHScrollTracking(HScrollTracking.VISIBLE);
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return new HiddenVScrollBar(container, this);
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
      return new InsetHScrollBar(container, this);
  }

  protected createTextLayer(contentDiv: HTMLDivElement): TextLayer {
    this._canvasTextLayer = new CanvasTextLayer(contentDiv, this._palette);
    return this._canvasTextLayer;
  }

  setPalette(palette: number[]): void {
    this._palette = palette;
    if (this._canvasTextLayer == null) {
      return;
    }
    this._canvasTextLayer.setPalette(palette);
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
