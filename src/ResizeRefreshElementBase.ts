/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import BulkDOMOperation = require('./BulkDOMOperation');
import LogDecorator = require('./logdecorator');

const log = LogDecorator;

export enum RefreshLevel {
  RESIZE = 1,
  COMPLETE = 2
};

/**
 * A base class for HTMLElements which also want to hear about possible resizes and refreshes.
 */
export class ResizeRefreshElementBase extends HTMLElement {
  
  static bulkRefreshChildNodes(node: Node, level: RefreshLevel): BulkDOMOperation.BulkDOMOperation {
    const kids = node.childNodes;
    const operations: BulkDOMOperation.BulkDOMOperation[] = [];
    for (let i=0; i<kids.length; i++) {
      const kid = kids[i];
      if (ResizeRefreshElementBase.is(kid)) {
        operations.push(kid.bulkRefresh(level));
      } else {
        operations.push(ResizeRefreshElementBase.bulkRefreshChildNodes(kid, level));
      }
    }

    return BulkDOMOperation.fromArray(operations);
  }
  
  static is(node: Node): node is ResizeRefreshElementBase {
    return node !== null && node !== undefined && node instanceof ResizeRefreshElementBase;
  }

  refresh(level: RefreshLevel): void {
    BulkDOMOperation.execute(this.bulkRefresh(level));
  }

  bulkRefresh(level: RefreshLevel): BulkDOMOperation.BulkDOMOperation {
    return ResizeRefreshElementBase.bulkRefreshChildNodes(this, level);
  }
}
