/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import LogDecorator = require('./logdecorator');

const log = LogDecorator;

/**
 * A base class for HTMLElements which also want to hear about possible resizes and refreshes.
 */
class ResizeRefreshElementBase extends HTMLElement {
  
  static resizeChildNodes(node: Node): void {
    const kids = node.childNodes;
    for (let i=0; i<kids.length; i++) {
      const kid = kids[i];
      if (ResizeRefreshElementBase.is(kid)) {
        kid.resize();
      } else {
        ResizeRefreshElementBase.resizeChildNodes(kid);
      }
    }
  }
  
  static is(node: Node): node is ResizeRefreshElementBase {
    return node !== null && node !== undefined && node instanceof ResizeRefreshElementBase;
  }

  resize(): void {
    ResizeRefreshElementBase.resizeChildNodes(this);
  }
}

export = ResizeRefreshElementBase;
