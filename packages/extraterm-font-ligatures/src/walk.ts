import { FlattenedLookupTree, LookupResult } from './types';

export default function walkTree(tree: FlattenedLookupTree, sequence: number[], startIndex: number, index: number): LookupResult | undefined {
  let bestLookup: LookupResult = undefined;

  while (true) {
    const subtree = tree.get(sequence[index]);
    if (!subtree) {
      return bestLookup;
    }

    bestLookup = chooseBestLookup(bestLookup, subtree.lookup);
    if (subtree.reverse) {
      const reverseLookup = walkReverse(subtree.reverse, sequence, startIndex);
      bestLookup = chooseBestLookup(bestLookup, reverseLookup);
    }

    index++;
    if (index >= sequence.length || !subtree.forward) {
      return bestLookup;
    }
    tree = subtree.forward;
  }
}

function chooseBestLookup(aLookup: LookupResult, bLookup: LookupResult): LookupResult {
  if (bLookup == null) {
    return aLookup;
  }
  if (aLookup == null) {
    return bLookup;
  }
  if ((aLookup.index > bLookup.index) || (aLookup.index === bLookup.index && aLookup.subIndex > bLookup.subIndex)) {
    return bLookup;
  }
  return aLookup;
}

function walkReverse(tree: FlattenedLookupTree, sequence: number[], index: number): LookupResult | undefined {
  --index;
  let subtree = tree.get(sequence[index]);
  let lookup: LookupResult | undefined = subtree && subtree.lookup;
  while (subtree) {
    lookup = chooseBestLookup(lookup, subtree.lookup);

    --index;
    if (index < 0 || !subtree.reverse) {
      break;
    }

    subtree = subtree.reverse.get(sequence[index]);
  }

  return lookup;
}
