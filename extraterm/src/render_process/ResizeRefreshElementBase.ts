/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import log from '../logging/LogDecorator';

export enum RefreshLevel {
  RESIZE = 1,
  COMPLETE = 2
};

/**
 * A base class for HTMLElements which also want to hear about possible resizes and refreshes.
 */
export class ResizeRefreshElementBase extends HTMLElement {
  
  static refreshChildNodes(node: Node, level: RefreshLevel): void {
    const kids = node.childNodes;
    for (let i=0; i<kids.length; i++) {
      const kid = kids[i];
      if (ResizeRefreshElementBase.is(kid)) {
        kid.refresh(level);
      } else {
        ResizeRefreshElementBase.refreshChildNodes(kid, level);
      }
    }
  }
  
  static is(node: Node): node is ResizeRefreshElementBase {
    return node !== null && node !== undefined && node instanceof ResizeRefreshElementBase;
  }

  refresh(level: RefreshLevel): void {
    ResizeRefreshElementBase.refreshChildNodes(this, level);
  }
}
