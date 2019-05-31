/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, HScrollTracking, VScrollBar, TextLayer } from "ace-ts";
import { CanvasTextLayer } from "./CanvasTextLayer";


export class TerminalCanvasRenderer extends Renderer {

  constructor(container: HTMLElement) {
    super(container, { injectCss: false, fontSize: null });
    this.setHScrollTracking(HScrollTracking.VISIBLE);
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return new HiddenVScrollBar(container, this);
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
      return new InsetHScrollBar(container, this);
  }

  protected createTextLayer(contentDiv: HTMLDivElement): TextLayer {
    return new CanvasTextLayer(contentDiv);
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
