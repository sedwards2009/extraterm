/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Compare two sets for equality
 * 
 * Members of the sets are compared using the `Set.has()` test.
 * 
 * @return True if the sets are equivalent to each other.
 */
export function equals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a == null || b == null) {
    return false;
  }

  for (const item of a) {
    if ( ! b.has(item)) {
      return false;
    }
  }

  for (const item of b) {
    if ( ! a.has(item)) {
      return false;
    }
  }
  return true;
}
