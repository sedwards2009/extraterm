/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import CodeMirrorOperation = require("./codemirroroperation");

/**
 * Represents a complex DOM operation which can be done in smaller steps and
 * interleaved with other operations to optimize DOM usage and avoid thrashing.
 * 
 * The idea is that multiple BulkDOMOperation objects can be collected and
 * then the execution of each operation can be interleaved with the others.
 *
 * There is nothing inside this object which a user of BulkDOMOperation should
 * call directly.
 */
export interface BulkDOMOperation {
  vote(): GeneratorPhase[];
  runPhase(phase: GeneratorPhase): BulkDOMOperation;
}

/**
 * Create a single BulkDOMOperation which calls an array of BulkDOMOperations.
 * 
 * @param operations the list of BulkDOMOperations to called later.
 * @return a single BulkDOMOperation which calls each BulkDOMOperation in the
 *          list.
 */
export function fromArray(originalOperations: BulkDOMOperation[]): BulkDOMOperation {
  if (originalOperations == null || originalOperations.length === 0) {
    return nullOperation();
  }

  let operations = originalOperations;

  return {
    vote(): GeneratorPhase[] {
      return operations.map( op => op.vote() ).reduce( (a,b) => [...a, ...b]);
    },

    runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
      const extraOperations: BulkDOMOperation[] = [];
      for (let i=0; i<operations.length; i++) {
        const extraOperation = operations[i].runPhase(currentPhase);
        if (extraOperation != null) {
          extraOperations.push(extraOperation);
        }
      }

      if (extraOperations.length !== 0) {
        operations = [...operations, ...extraOperations];
      }

      return null;
    }
  };
}

/**
 * Messages for the generator/coroutine protocol. These specify the phases
 * that the generator can request / announce.
 */
export enum GeneratorPhase {
  PRESTART = 0,
  BEGIN_DOM_READ = 1,
  BEGIN_DOM_WRITE = 2,
  FLUSH_DOM = 3,
// WAITING = 4,
  BEGIN_FINISH = 5,
  DONE = 6
}

export type GeneratorResult = GeneratorPhase | { phase: GeneratorPhase; extraOperation?: BulkDOMOperation; };

/**
 * Create a BulkDOMOperation object from a generator.
 * 
 * A generator is created by using a JavaScript generator function. The
 * generator yields `GeneratorResult` values to indicate to the caller what
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
export function fromGenerator(generator: IterableIterator<GeneratorResult>): BulkDOMOperation {
  let phase = GeneratorPhase.PRESTART;

  return {
    vote: (): GeneratorPhase[] => {
      if (phase === GeneratorPhase.PRESTART) {
        const result = runGenerator(generator);
        if (typeof result === 'object') {
          // The first call to the generator MAY NOT return a new operation.
          phase = result.phase;
        } else {
          phase = result;
        }
      }
      return [phase];
    },

    runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
      if (phase === currentPhase) {
        const result = runGenerator(generator);
        if (typeof result === 'object') {
          phase = result.phase;
          return result.extraOperation;
        } else {
          phase = result;
        }
      }
      return null;
    }
  };
}

function runGenerator(generator: IterableIterator<GeneratorResult>): GeneratorResult {
  const result = generator.next();
  if (typeof result.value === 'object') {
    if (result.value.extraOperation == null) {
      return result.done ? GeneratorPhase.DONE : result.value.phase;
    } else {
      if (result.done) {
        return { phase: GeneratorPhase.DONE, extraOperation: result.value.extraOperation };
      } else {
        return result.value;
      }
    }
  } else {
    return result.done ? GeneratorPhase.DONE : result.value;
  } 
}

const nullOperationObject = {
  vote(): GeneratorPhase[] {
    return [GeneratorPhase.DONE];
  },
  runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
    return null;
  }
};

export function nullOperation(): BulkDOMOperation {
  return nullOperationObject;
}

/**
 *
 * 
 * @param operation
 * @param contextFunc 
 */
export function execute(operation: BulkDOMOperation, contextFunc?: (f: () => void) => void): void {
  let topOperation = operation;
  let lastPhase = GeneratorPhase.BEGIN_DOM_READ;

  if (contextFunc === undefined) {
    contextFunc = (f) => f();
  }

  let done = false;
  while ( ! done) {
    contextFunc( () => {
      while ( ! done) {
        const votes = topOperation.vote();
        const nextPhase = findTopVote(votes, lastPhase);

        if (nextPhase === GeneratorPhase.FLUSH_DOM) {
          break;
        }

        if (nextPhase === GeneratorPhase.DONE) {
          done = true;
          break;
        }

        const newOperation = topOperation.runPhase(nextPhase);
        if (newOperation != null) {
          topOperation = fromArray( [topOperation, newOperation] );
        }

        lastPhase = nextPhase;
      }
    });

    if ( ! done) {
      // Special handling for FLUSH_DOM.
      const votes = topOperation.vote();
      const nextPhase = findTopVote(votes, lastPhase);
      if (nextPhase === GeneratorPhase.FLUSH_DOM) {
        const newOperation = topOperation.runPhase(nextPhase);
        if (newOperation != null) {
          topOperation = fromArray( [topOperation, newOperation] );
        }
      }      
    }    
  }
}

function findTopVote(votes: GeneratorPhase[], lastWinner: GeneratorPhase): GeneratorPhase {
  // Look for the previus winner.
  for (let i=0; i<votes.length; i++) {
    if (votes[i] === lastWinner) {
      return lastWinner
    }
  }

  // Find the highest ranked vote then.
  let bestVote = GeneratorPhase.DONE;
  for (let i=0; i<votes.length; i++) {
    bestVote = Math.min(bestVote, votes[i]);
  }
  return bestVote;
}
