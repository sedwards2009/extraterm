/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import Logger = require('./logger'); 

const _log = new Logger("BulkDOMOperation");
const DEBUG = false;
const DEBUG_FINE = false;

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
      const len = operations.length;
      const result: GeneratorPhase[] = [];

      for (let i=0; i<len; i++) {
        const newVotes = operations[i].vote();

        // Add the votes to the result array.
        const len2 = newVotes.length;
        for (let j=0; j<len2; j++) {
          result.push(newVotes[j]);
        }
      }

      return result;
    },

    runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
      const extraOperations: BulkDOMOperation[] = [];
      const len = operations.length;
      for (let i=0; i<len; i++) {
        const extraOperation = operations[i].runPhase(currentPhase);
        if (extraOperation != null) {
          extraOperations.push(extraOperation);
        }
      }

      if (extraOperations.length !== 0) {
        operations = operations.concat(extraOperations);
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
  FLUSH_DOM = 3,  // FIXME flush Dom concept is bogus. DOM reads should always read a 'clean' state with nothing queued up, i.e. CodeMirror.
  BEGIN_FINISH = 4,
  DONE = 5,
  WAITING = 6,  // Note: The order/value of these enums are important.
}

// Versions of the enum in thier own lists for easy reuse and less pressure on the GC.
const GeneratorPhaseLists = new Map<GeneratorPhase, GeneratorPhase[]>();
GeneratorPhaseLists.set(GeneratorPhase.PRESTART, [GeneratorPhase.PRESTART]);
GeneratorPhaseLists.set(GeneratorPhase.BEGIN_DOM_READ, [GeneratorPhase.BEGIN_DOM_READ]);
GeneratorPhaseLists.set(GeneratorPhase.BEGIN_DOM_WRITE, [GeneratorPhase.BEGIN_DOM_WRITE]);
GeneratorPhaseLists.set(GeneratorPhase.FLUSH_DOM, [GeneratorPhase.FLUSH_DOM]);
GeneratorPhaseLists.set(GeneratorPhase.BEGIN_FINISH, [GeneratorPhase.BEGIN_FINISH]);
GeneratorPhaseLists.set(GeneratorPhase.DONE, [GeneratorPhase.DONE]);
GeneratorPhaseLists.set(GeneratorPhase.WAITING, [GeneratorPhase.WAITING]);

export type GeneratorResult = GeneratorPhase |
  {
    phase: GeneratorPhase;
    extraOperation?: BulkDOMOperation;  // Optional extra operation to execute along side the others.
    waitOperation?: BulkDOMOperation    // Optional operation to wait on till it reaches the finish stage.
  };

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
export function fromGenerator(generator: IterableIterator<GeneratorResult>, name: string="???"): BulkDOMOperation {
  let phase = GeneratorPhase.PRESTART;
  let waitingOperation: BulkDOMOperation = null;
  let waiting = false;

  return {
    vote: (): GeneratorPhase[] => {
      // Wait handling. If waiting then we case a WAITING vote.
      if (waitingOperation !== null) {
        const isWaitingDone = isFinishedDOM(waitingOperation);
        if ( ! isWaitingDone) {
          waiting = true;
          return GeneratorPhaseLists.get(GeneratorPhase.WAITING);
        }
        waitingOperation = null;
        waiting = false;
      }

      if (phase === GeneratorPhase.PRESTART) {
        const result = runGenerator(generator);
        if (typeof result === 'object') {
          // The first call to the generator MAY NOT return a new operation, but it may wait.
          if (result.extraOperation != null) {
            _log.warn("First run of the generator '" + name + "'returned an extra operation. This is not supported.");
          }

          waitingOperation = result.waitOperation != null ? result.waitOperation : null;
          phase = result.phase;
        } else {
          phase = result;
        }
      }
      if (DEBUG && DEBUG_FINE) {
        _log.debug("Vote " + name + " is " + GeneratorPhase[phase]);
      }
      return GeneratorPhaseLists.get(phase);
    },

    runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
      if (phase === currentPhase && ! waiting) {
        if (DEBUG) {
          _log.debug("    Running " + name + " phase " + GeneratorPhase[currentPhase]);
        }
        const result = runGenerator(generator);
        if (typeof result === 'object') {
          waitingOperation = result.waitOperation != null ? result.waitOperation : null;
          phase = result.phase;
          return result.extraOperation;
        } else {
          phase = result;
        }
      } else {
        if (DEBUG && DEBUG_FINE) {
          if (waiting) {
            _log.debug("    Not running " + name + " in phase " + GeneratorPhase[currentPhase] + ". It is WAITING.");
          } else {
            _log.debug("    Not running " + name + " phase " + GeneratorPhase[currentPhase] + ". Wrong phase.");
          }
        }
        
      }
      return null;
    }
  };
}

function isFinishedDOM(op: BulkDOMOperation): boolean {
  const votes = op.vote();
  const len = votes.length;
  for (let i=0; i<len; i++) {
    const vote = votes[i];
    if (vote !== GeneratorPhase.DONE && vote !== GeneratorPhase.BEGIN_FINISH) {
      return false;
    }
  }
  return true;
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
    return GeneratorPhaseLists.get(GeneratorPhase.DONE);
  },
  runPhase(currentPhase: GeneratorPhase): BulkDOMOperation {
    return null;
  }
};

export function nullOperation(): BulkDOMOperation {
  return nullOperationObject;
}

let executeCallDepth = 0;

/**
 *
 * 
 * @param operation
 * @param contextFunc 
 */
export function execute(operation: BulkDOMOperation, contextFunc?: (f: () => void) => void): void {
  if (executeCallDepth !== 0) {
    _log.warn("execute() has been called recursively! This can lead to update errors!");
    // console.trace();
  }

  executeCallDepth++;
  if (DEBUG) {
    _log.debug("------ Start execute() ------");
  }

  let topOperation = operation;
  let lastPhase = GeneratorPhase.BEGIN_DOM_READ;

  if (contextFunc === undefined) {
    contextFunc = (f) => f();
  }

  let done = false;
  while ( ! done) {
    if (DEBUG) {
      _log.debug("Entering context function.");
    }
    contextFunc( () => {
      while ( ! done) {
        if (DEBUG && DEBUG_FINE) {
          _log.debug("*** Voting ***");
        }
        const votes = topOperation.vote();
        const nextPhase = findTopVote(votes, lastPhase);

        if (DEBUG && DEBUG_FINE) {
          _log.debug("*** Winning phase is " + GeneratorPhase[nextPhase] + " ***");
        }

        if (nextPhase === GeneratorPhase.FLUSH_DOM) {
          break;
        }

        if (nextPhase === GeneratorPhase.DONE) {
          done = true;
          break;
        }

        if (DEBUG) {
          _log.debug("Running phase " + GeneratorPhase[nextPhase]);
        }
        const newOperation = topOperation.runPhase(nextPhase);
        if (newOperation != null) {
          topOperation = fromArray( [topOperation, newOperation] );
        }
        lastPhase = nextPhase;
      }
    });

    if (DEBUG) {
      _log.debug("Exited context function.");
    }

    if ( ! done) {
      // Special handling for FLUSH_DOM.
      const votes = topOperation.vote();
      const nextPhase = findTopVote(votes, lastPhase);
      if (nextPhase === GeneratorPhase.FLUSH_DOM) {
        if (DEBUG) {
          _log.debug("Running phase " + GeneratorPhase[nextPhase] + " ***");
        }
        const newOperation = topOperation.runPhase(nextPhase);
        if (newOperation != null) {
          topOperation = fromArray( [topOperation, newOperation] );
        }
      }      
    }    
  }
  executeCallDepth--;
  if (DEBUG) {
    _log.debug("------ End execute() ------");
  }
}

function findTopVote(votes: GeneratorPhase[], lastWinner: GeneratorPhase): GeneratorPhase {
  // Look for the previus winner.
  const len = votes.length;
  for (let i=0; i<len; i++) {
    if (votes[i] === lastWinner) {
      return lastWinner
    }
  }

  // Find the highest ranked vote then.
  let bestVote = GeneratorPhase.DONE;
  for (let i=0; i<len; i++) {
    const vote = votes[i];
    bestVote = bestVote < vote ? bestVote : vote;
  }
  return bestVote;
}
