/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from '@extraterm/extraterm-extension-api';
import { PairKeyMap } from "extraterm-data-structures";
import { EventEmitter } from '../utils/EventEmitter';
import { createUuid } from "extraterm-uuid";
import { getLogger, Logger, log } from "extraterm-logging";

export type JsonValue = any;

export interface AllData {
  [namespace: string]: {[key: string]: JsonValue};
}

export enum ChangeType {
  ADDED = "ADDED",
  CHANGED = "CHANGED",
  DELETED = "DELETED",
}

/**
 * Event describing a change to a shared map.
 */
export interface ChangeEvent {
  /**
   * The type of event.
   *
   * One of added, changed, or deleted.
   */
  type: ChangeType;

  /**
   * The namespace affected.
   */
  namespace: string;

  /**
   * The affected key inside the namespace.
   */
  key: string;

  /**
   * The previous value.
   */
  oldValue: JsonValue;

  /**
   * The new value or the last value in the case of a delete event.
   */
  value: JsonValue;

  /**
   * True if this event originated in the local instance.
   */
  isLocalOrigin: boolean;

  /**
   * The UUID of the instance where this even originated.
   */
  originUUID: string;
}

/**
 * A map which supports namespaced string keys to JSON compatible objects.
 *
 * This is built to support a shared distributed map across processes. By
 * listening to `onChange` events, broadcasting them to remote instances,
 * and applying received events with `sync()`, distributed copies of the
 * map can synchronize with each other.
 */
export class SharedMap {
  private _log: Logger = null;

  onChange: Event<ChangeEvent>;

  #onChangeEventEmitter = new EventEmitter<ChangeEvent>();
  #data = new PairKeyMap<string, string, JsonValue>();

  #instanceUUID: string;

  constructor() {
    this._log = getLogger("SharedMap", this);
    this.#instanceUUID = createUuid();
    this.onChange = this.#onChangeEventEmitter.event;
  }

  /**
   * Update this map with an event from a remote instance.
   */
  sync(event: ChangeEvent): void {
    if (event.originUUID === this.#instanceUUID) {
      return;
    }
    this._applyEvent(event);
  }

  loadAll(allData: AllData): void {
    this.#data = new PairKeyMap<string, string, JsonValue>();
    for (const namespace of Object.getOwnPropertyNames(allData)) {
      const namespaceObject = allData[namespace];
      for (const key of Object.getOwnPropertyNames(namespaceObject)) {
        this.#data.set(namespace, key, namespaceObject[key]);
      }
    }
  }

  dumpAll(): AllData {
    const result = {};
    for (const namespace of this.#data.level0Keys()) {
      const namespaceObject = {};
      result[namespace] = namespaceObject;
      for (const key of this.#data.level1Keys(namespace)) {
        namespaceObject[key] = this.#data.get(namespace, key);
      }
    }
    return result;
  }

  private _applyEvent(event: ChangeEvent): void {
    const { namespace, key, value } = event;
    switch (event.type) {
      case ChangeType.ADDED:
      case ChangeType.CHANGED:
        this.#data.set(namespace, key, value);
        break;

      case ChangeType.DELETED:
        this.#data.delete(namespace, key);
        break;
    }
    event.isLocalOrigin = this.#instanceUUID === event.originUUID;
    this.#onChangeEventEmitter.fire(event);
  }

  /**
   */
  get(namespace: string, key: string): JsonValue {
    return this.#data.get(namespace, key);
  }

  /**
   * Set a namespace+key to a value.
   *
   * This will fire an event before the method returns.
   */
  set(namespace: string, key: string, value: JsonValue): void {
    const oldValue = this.#data.get(namespace, key);
    this._applyEvent({
      type: oldValue === undefined ? ChangeType.ADDED : ChangeType.CHANGED,
      namespace,
      key,
      oldValue,
      value,
      originUUID: this.#instanceUUID,
      isLocalOrigin: true,
    });
  }

  /**
   * True if the namespace+key maps to a value.
   */
  has(namespace: string, key: string): boolean {
    return this.#data.has(namespace, key);
  }

  /**
   * Delete the value at a namespace+key.
   *
   * This will fire an event before the method returns.
   */
  delete(namespace: string, key: string): void {
    const oldValue = this.#data.get(namespace, key);
    if (oldValue === undefined) {
      return;
    }

    this._applyEvent({
      type: ChangeType.DELETED,
      namespace,
      key,
      oldValue: oldValue,
      value: null,
      originUUID: this.#instanceUUID,
      isLocalOrigin: true,
    });
  }

  /**
   * Delete all of the keys under a namespace
   */
  deleteNamespace(namespace: string): void {
    const keys = Array.from(this.#data.level1Keys(namespace));
    for (const key of keys) {
      this.delete(namespace, key);
    }
  }
}
