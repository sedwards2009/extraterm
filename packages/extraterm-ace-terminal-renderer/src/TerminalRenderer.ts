/**
 * Copyright 2015-2018 Simon Edwards <simon@simonzone.com>
 */

import { Renderer, HScrollBar, VScrollBar } from "ace-ts";

export class TerminalRenderer extends Renderer {

  constructor(container: HTMLElement) {
    super(container, { injectCss: false, fontSize: null });
  }

  protected createVScrollBar(container: HTMLElement): VScrollBar {
    return new HiddenVScrollBar(container, this);
  }

  protected createHScrollBar(container: HTMLElement): HScrollBar {
      return new HiddenHScrollBar(container, this);
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

class HiddenHScrollBar extends HScrollBar {
  
  setVisible(isVisible: boolean): this {
    if (isVisible === false) {
      super.setVisible(false);    // Stop the scrollbar from ever being visible.
    }
    return this;
  }
}
