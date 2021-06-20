/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  Event,
  TerminalEnvironment,
} from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";


export class TerminalEnvironmentImpl implements TerminalEnvironment {

  #map = new Map<string, string>();

  onChange: Event<string[]>;
  #onChangeEventEmitter = new EventEmitter<string[]>();

  constructor(defaultList: {key:string, value: string}[]) {
    this.onChange = this.#onChangeEventEmitter.event;
    this.setList(defaultList);
  }

  get(key: string): string {
    return this.#map.get(key);
  }

  has(key: string): boolean {
    return this.#map.has(key);
  }

  set(key: string, value: string): void {
    const oldValue = this.#map.get(key);
    if (oldValue !== value) {
      this.#map.set(key, value);
      this.#onChangeEventEmitter.fire([key]);
    }
  }

  setList(list: {key: string, value: string}[]): void {
    const changeList = [];
    for (const pair of list) {
      const oldValue = this.#map.get(pair.key);
      if (oldValue !== pair.value) {
        this.#map.set(pair.key, pair.value);
        changeList.push(pair.key);
      }
    }

    if (changeList.length !== 0) {
      this.#onChangeEventEmitter.fire(changeList);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.#map.entries();
  }

  entries(): IterableIterator<[string, string]> {
    return this.#map.entries();
  }
}
