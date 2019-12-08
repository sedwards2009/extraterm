/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

class TrieNode<K, V> {
  private children = new Map<K, TrieNode<K, V> | null>();
  private value: V = null;

  insert(index: number, key: ReadonlyArray<K>, value: V): void {
    if (index >= key.length) {
      this.value = value;
      return;
    }

    const subkey = key[index];
    let childNode: TrieNode<K, V>;
    if ( ! this.children.has(subkey)) {
      childNode = new TrieNode<K, V>();
      this.children.set(subkey, childNode);
    } else {
      childNode = this.children.get(subkey);
    }

    childNode.insert(index+1, key, value);
  }

  get(index: number, key: ReadonlyArray<K>): V | null {
    if (index >= key.length) {
      return this.value;
    }

    const subkey = key[index];
    const childNode = this.children.get(subkey);
    if (childNode == null) {
      return null;
    }

    return childNode.get(index+1, key);
  }
}

/**
 * Trie data structure for mapping variable length arrays to data.
 */
export class ArrayKeyTrie<K, V> {

  private _root = new TrieNode<K, V>();

  /**
   * Insert a mapping from a key to a value
   * 
   * @param key Array-like object of ordered keys
   * @param value Value to associate with the key
   */
  insert(key: ReadonlyArray<K>, value: V): void {
    if (key.length === 0) {
      return;
    }
    this._root.insert(0, key, value);
  }

  /**
   * Get a value by a key
   * 
   * @param key the key to look up with.
   * @return The corresponding value for the key or null if one was not found.
   */
  get(key: ReadonlyArray<K>): V | null {
    if (key.length === 0) {
      return null;
    }
    return this._root.get(0, key);
  }
}
