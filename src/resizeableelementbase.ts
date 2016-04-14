/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import LogDecorator = require('./logdecorator');

const log = LogDecorator;

/**
 * A base class for HTMLElements which also want to hear about possible resizes.
 */
class ResizeableElementBase extends HTMLElement {
  
  static resizeChildNodes(node: Node): void {
    const kids = node.childNodes;
    for (let i=0; i<kids.length; i++) {
      const kid = kids[i];
      if (ResizeableElementBase.is(kid)) {
        kid.resize();
      } else {
        ResizeableElementBase.resizeChildNodes(kid);
      }
    }
  }
  
  static is(node: Node): node is ResizeableElementBase {
    return node !== null && node !== undefined && node instanceof ResizeableElementBase;
  }

  resize(): void {
    ResizeableElementBase.resizeChildNodes(this);
  }
}

export = ResizeableElementBase;
