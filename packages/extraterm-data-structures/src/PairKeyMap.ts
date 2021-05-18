/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Map which takes 2 values to form the key.
 */
export class PairKeyMap<K1, K2, V> {

  private _rootMap = new Map<K1, Map<K2, V>>();

  /**
   * Get a value by keys
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @return The corresponding value for the keys or undefined if one was not found.
   */
  get(key1: K1, key2: K2): V {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return undefined;
    }
    return level1.get(key2);
  }

  /**
   * Update or set a mapping from a key to a value
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @param value Value to associate with the keys
   */
  set(key1: K1, key2: K2, value: V): void {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      const level1 = new Map<K2, V>();
      this._rootMap.set(key1, level1);

      level1.set(key2, value);
      return;
    }

    level1.set(key2, value);
  }

  /**
   * Test if this map has a key.
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @returns True if this map has the key, otherwise false.
   */
  has(key1: K1, key2: K2): boolean {
    const value = this.get(key1, key2);
    return value !== undefined;
  }

  /**
   * Delete the given key and its value
   *
   * @param key1 the first part of the key to look up with.
   * @param key2 the second part of the key to look up with.
   * @return true if the key was found and deleted, otherwise false.
   */
  delete(key1: K1, key2: K2): boolean {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return false;
    }

    const level2 = level1.get(key2);
    if (level2 === undefined) {
      return false;
    }

    level1.delete(key2);

    if (level1.size === 0) {
      this._rootMap.delete(key1);
    }

    return true;
  }

  *values(): IterableIterator<V> {
    for (const level1 of this._rootMap.values()) {
      for (const value of level1.values()) {
        yield value;
      }
    }
  }

  /**
   * Create an iterator for the K1 keys.
   */
  level0Keys(): IterableIterator<K1> {
    return this._rootMap.keys();
  }

  /**
   * Create an iterator for the K2 keys given a K1 key.
   */
  *level1Keys(key1: K1): IterableIterator<K2> {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return;
    }
    for (const key of level1.keys()) {
      yield key;
    }
  }

  /**
   * Create an iterator over the values for key K1.
   */
  *level1Values(key1: K1): IterableIterator<V> {
    const level1 = this._rootMap.get(key1);
    if (level1 === undefined) {
      return;
    }
    for (const value of level1.values()) {
      yield value;
    }
  }

  /**
   * Copy this `PairKeyMap`.
   *
   * Values are not copied, just referenced.
   */
  copy(): PairKeyMap<K1, K2, V> {
    const newCopy = new PairKeyMap<K1, K2, V>();
    for (const [key1, level1Map] of this._rootMap) {
      for (const [key2, value] of level1Map) {
        newCopy.set(key1, key2, value);
      }
    }
    return newCopy;
  }
}
