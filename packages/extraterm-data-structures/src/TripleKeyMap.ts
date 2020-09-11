/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Map which takes 3 values to form the key.
 */
export class TripleKeyMap<K1, K2, K3, V> {

  private _rootMap = new Map<K1, Map<K2, Map<K3, V>>>();

  /**
   * Get a value by keys
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @param key3 the thired part of the key to look up with.
   * @return The corresponding value for the keys or undefined if one was not found.
   */
  get(key1: K1, key2: K2, key3: K3): V {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return undefined;
    }
    const level2 = level1.get(key2);
    if (level2 === undefined) {
      return undefined;
    }
    return level2.get(key3);
  }

  /**
   * Update or set a mapping from a key to a value
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @param key3 the thired part of the key to look up with.
   * @param value Value to associate with the keys
   */
  set(key1: K1, key2: K2, key3: K3, value: V): void {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      const level1 = new Map<K2, Map<K3, V>>();
      this._rootMap.set(key1, level1);

      const level2 = new Map<K3, V>();
      level1.set(key2, level2);

      level2.set(key3, value);
      return;
    }

    const level2 = level1.get(key2);
    if (level2 === undefined) {
      const level2 = new Map<K3, V>();
      level1.set(key2, level2);

      level2.set(key3, value);
      return;
    }

    level2.set(key3, value);
  }

  /**
   * Delete the given key and its value
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @param key3 the thired part of the key to look up with.
   * @return true if the key was found and deleted, otherwise false.
   */
  delete(key1: K1, key2: K2, key3: K3): boolean {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return false;
    }

    const level2 = level1.get(key2);
    if (level2 === undefined) {
      return false;
    }

    const level3 = level2.get(key3);
    if (level3 === undefined) {
      return false;
    }
    level2.delete(key3);

    if (level2.size === 0) {
      level1.delete(key2);
    }
    if (level1.size === 0) {
      this._rootMap.delete(key1);
    }

    return true;
  }

  *values(): IterableIterator<V> {
    for (const level1 of this._rootMap.values()) {
      for (const level2 of level1.values()) {
        for (const value of level2.values()) {
          yield value;
        }
      }
    }
  }
}
