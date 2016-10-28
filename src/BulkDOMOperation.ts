/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

/**
 * Represents a complex DOM operation which can be done in smaller steps and
 * interleaved with other operations to optimize DOM usage and avoid thrashing.
 * 
 * The idea is that multiple BulkDOMOperation objects can be collected and
 * then the execution of each operation can be interleaved with the others.
 * This is done by first calling `runStep` once on each operation in the group
 * and then calling `runStep` again for all, and again until all of them
 * return true. Then the `finish` functions must be called for all.
 * 
 * Note that these functions are both optional and thus may be missing.
 */
export interface BulkDOMOperation {
  /**
   * Execute one step of this operation.
   * 
   * This function is called multiple times until it returns true. This
   * function should also be prepared to do nothing and return true if
   * it is called again after having returned true.
   * 
   * @return True if this function is complete, otherwise false.
   */
  runStep?(): boolean;

  /**
   * Finish the operation.
   * 
   * This function is called once all of the steps are complete.
   */
  finish?(): void;
}

/**
 * Create a single BulkDOMOperation which calls an array of BulkDOMOperations.
 * 
 * @param operations the list of BulkDOMOperations to called later.
 * @return a single BulkDOMOperation which calls each BulkDOMOperation in the
 *          list.
 */
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

/**
 * Execute both the step and finish phases of a BulkDOMOperation.
 * 
 * @param operation the operation to fully execute.
 */
export function execute(operation: BulkDOMOperation): void {
  executeRunSteps(operation);
  executeFinish(operation);
}

/**
 * Execute all of the steps in an operation.
 * 
 * @param operation the operation with the `runStep` function to execute.
 */
export function executeRunSteps(operation: BulkDOMOperation): void {
  if (operation == null || operation.runStep === undefined) {
    return;
  }

  const runStep = operation.runStep;
  while (runStep() === false) ;
}

/**
 * Execute the finish phase of an operation.
 * 
 * @param operation the operation with the `runStep` function to execute.
 */
export function executeFinish(operation: BulkDOMOperation): void {
  if (operation == null || operation.finish === undefined) {
    return;
  }
  operation.finish();
}
