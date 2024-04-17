/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { EmbeddedImage, EmbeddedImageMap } from "extraterm-char-render-canvas";

export class TerminalEmbeddedImages {

  #embeddedImageMap: EmbeddedImageMap = new Map<number, EmbeddedImage>();

  constructor(original: TerminalEmbeddedImages=null) {
    if (original == null) {
      this.#embeddedImageMap = new Map<number, EmbeddedImage>();
    } else {
      this.#embeddedImageMap = new Map<number, EmbeddedImage>([...original.getMap()]);
    }
  }

  getMap(): EmbeddedImageMap {
    return this.#embeddedImageMap;
  }

  clone(): TerminalEmbeddedImages {
    return new TerminalEmbeddedImages(this);
  }
}
