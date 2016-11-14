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

/**
 * Messages for the generator/coroutine protocol. These specify the phases
 * that the generator can request / announce.
 */
export enum GeneratorPhase {
  PRESTART,
  BEGIN_DOM_READ,
  BEGIN_DOM_WRITE,
  BEGIN_FINISH,
  DONE
}

/**
 * Create a BulkDOMOperation object from a generator.
 * 
 * A generator is created by using a JavaScript generator function. The
 * generator yields `GeneratorPhase` values to indicate to the caller what
 * kind of operation it will do next on the DOM. When the generator is called
 * it may perform the kind of DOM operation (i.e. a read or write, but not
 * both) that it requested by the last yield. By requiring that the generator
 * declare it's intention first, it is possible to coordinate multiple
 * `BulkDOMOperation` objects to group DOM reads and writes and avoid a lot of
 * DOM thrashing.
 * 
 * The thing a generator should do is `yield` a `BEGIN_DOM_READ` or
 * `BEGIN_DOM_WRITE`. On the next call, the generator performs the DOM
 * operation and then yield the next value. It may continue yielding
 * `BEGIN_DOM_READ` or `BEGIN_DOM_WRITE` values until it is done modifying
 * or reading the DOM. After that it may `return`, or indicate that it has
 * some finishing work to do such as send signals. This is indicated by the
 * `BEGIN_FINISH` value.
 * 
 * @param generator the generator to wrap
 * @return the BulkDOMOperation which wraps the generator.
 */
export function fromGenerator(generator: IterableIterator<GeneratorPhase>): BulkDOMOperation {
  let runCounter = 0; // Even steps are DOM writes, odd are DOM reads.
  let phase = GeneratorPhase.PRESTART;

  return {
    runStep: (): boolean => {

      const mayDOMRead = runCounter % 2 === 0;
      const mayDOMWrite = ! mayDOMRead;
      runCounter++;

      switch (phase) {
        
        // The generator hasn't been called yet.
        case GeneratorPhase.PRESTART:
          const result = runGenerator(generator);
          switch (result) {
            case GeneratorPhase.BEGIN_DOM_WRITE:
              // We may do a DOM write in the first call to runStep().
              phase = runGenerator(generator); // Let it run and collect the next desire.
              break;

            default:
              phase = result;
              break;
          }
          break;

        case GeneratorPhase.BEGIN_DOM_READ:
          if (mayDOMRead) {
            phase = runGenerator(generator);
          }
          break;

        case GeneratorPhase.BEGIN_DOM_WRITE:
          if (mayDOMWrite) {
            phase = runGenerator(generator);
          }
          break;

        default:
            break;
      }
      return phase !== GeneratorPhase.BEGIN_DOM_READ && phase !== GeneratorPhase.BEGIN_DOM_WRITE;
    },

    finish: (): void => {
      if (phase === GeneratorPhase.BEGIN_FINISH) {
        generator.next();
        phase = GeneratorPhase.DONE;
      }
    }
  };
}

function runGenerator(generator: IterableIterator<GeneratorPhase>): GeneratorPhase {
  const result = generator.next();
  return result.done ? GeneratorPhase.DONE : result.value;
}
