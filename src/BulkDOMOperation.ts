/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

/**
 * Represents a complex DOM operation which can be done in smaller steps and
 * interleaved with other operations to optimize the operations on the DOM and
 * avoid DOM thrashing.
 */
export interface BulkDOMOperation {
  runStep?(): boolean;
  finish?(): void;
}

export function fromArray(operations: BulkDOMOperation[]): BulkDOMOperation {
  if (operations.length === 0 || operations.every( (op) => op.runStep == null && op.finish == null)) {
    return {};
  }

  return {
    runStep: (): boolean => {
      let done = true;
      for (let i=0; i<operations.length; i++) {
        const operation = operations[i];
        if (operation.runStep != null) {
          if (operation.runStep() === false) {
            done = false;
          }
        }
      }
      return done;
    },

    finish: (): void => {
      for (let i=0; i<operations.length; i++) {
        const operation = operations[i];
        if (operation.finish != null) {
          operation.finish();
        }
      }      
    }
  };
}

export function execute(operation: BulkDOMOperation): void {
  if (operation == null) {
    return;
  }

  const runStep = operation.runStep;
  if (runStep != null) {
    while (runStep() === false) ;
  }

  const finish = operation.finish;
  if (finish != null) {
    finish();
  }
}
