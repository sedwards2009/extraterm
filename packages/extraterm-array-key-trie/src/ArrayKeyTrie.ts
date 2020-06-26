/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type Primitive = string | number | boolean;

export interface Indexable {
  length: number;
  [index: number]: Primitive;
}

class TrieNode<V> {
  private children: Map<Primitive, TrieNode<V> | null> = null;
  private value: V = null;

  insert(index: number, key: Indexable, value: V): void {
    if (index >= key.length) {
      this.value = value;
      return;
    }

    const subkey = key[index];
    let childNode: TrieNode<V>;

    if (this.children == null) {
      this.children = new Map<Primitive, TrieNode<V> | null>();
    }

    if ( ! this.children.has(subkey)) {
      childNode = new TrieNode<V>();
      this.children.set(subkey, childNode);
    } else {
      childNode = this.children.get(subkey);
    }

    childNode.insert(index+1, key, value);
  }

  get(index: number, key: Indexable): V | null {
    if (index >= key.length) {
      return this.value;
    }

    const subkey = key[index];
    const childNode = this.children?.get(subkey);
    if (childNode == null) {
      return undefined;
    }

    return childNode.get(index+1, key);
  }

  getPrefix(index: number, key: Indexable): { value: V | null, length: number } {
    if (index >= key.length) {
      return { value: this.value, length: index };
    }

    const subkey = key[index];
    const childNode = this.children?.get(subkey);
    if (childNode == null) {
      return { value: this.value, length: index };
    }

    return childNode.getPrefix(index+1, key);
  }

  delete(index: number, key: Indexable): boolean {
    if (index >= key.length) {
      this.value = undefined;
      return true;
    }

    const childNode = this.children?.get(key[index]);
    if (childNode == null) {
      return false;
    }

    const result = childNode.delete(index+1, key);
    if (result && childNode.isEmpty()) {
      this.children.delete(key[index]);
    }
    return result;
  }

  isEmpty(): boolean {
    return this.value === undefined && (this.children == null || this.children.size === 0);
  }
}


/**
 * Trie data structure for mapping variable length arrays to data.
 */
export class ArrayKeyTrie<V> {

  private _root = new TrieNode<V>();

  /**
   * Update or set a mapping from a key to a value
   *
   * @param key Array-like object of ordered keys
   * @param value Value to associate with the key
   */
  set(key: Indexable, value: V): void {
    if (key.length === 0) {
      return;
    }
    this._root.insert(0, key, value);
  }

  /**
   * Get a value by key
   *
   * @param key the key to look up with.
   * @return The corresponding value for the key or null if one was not found.
   */
  get(key: Indexable): V | undefined {
    if (key.length === 0) {
      return undefined;
    }
    return this._root.get(0, key);
  }

  /**
   * Match as much as possible using the given key
   *
   * @param key the key to look up with.
   * @param index the index into the key to start matching at.
   * @return the value found and how much of the key was matched.
   */
  getPrefix(key: Indexable, index=0): { value: V | null, length: number } {
    const result = this._root.getPrefix(index, key);
    result.length -= index;
    return result;
  }

  /**
   * Delete the given key
   *
   * @param key the key to look up with.
   * @return true if the key was found and deleted, otherwise false.
   */
  delete(key: Indexable): boolean {
    return this._root.delete(0, key);
  }
}
