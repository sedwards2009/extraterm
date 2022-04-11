import { LookupTree, FlattenedLookupTree, LookupTreeEntry, FlattenedLookupTreeEntry } from './types.js';

export function flatten(tree: LookupTree): FlattenedLookupTree {
  const result: FlattenedLookupTree = new Map<number, FlattenedLookupTreeEntry>();
  for (const [glyphId, entry] of tree.individual.entries()) {
    result.set(glyphId, flattenEntry(entry));
  }

  for (const { range, entry } of tree.range) {
    const flattened = flattenEntry(entry);
    for (let glyphId = range[0]; glyphId < range[1]; glyphId++) {
      result.set(glyphId, flattened);
    }
  }

  return result;
}

function flattenEntry(entry: LookupTreeEntry): FlattenedLookupTreeEntry {
  const result: FlattenedLookupTreeEntry = {};

  if (entry.forward) {
    result.forward = flatten(entry.forward);
  }

  if (entry.reverse) {
    result.reverse = flatten(entry.reverse);
  }

  if (entry.lookup) {
    result.lookup = entry.lookup;
  }

  return result;
}
