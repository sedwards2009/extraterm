/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Event } from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { createUuid } from "extraterm-uuid";
import { ExtensionDesiredState, ExtensionMetadata } from "./ExtensionMetadata";
import { SharedMap, ChangeEvent, ChangeType } from "./shared_map/SharedMap";


const EXTENSION_NAMESPACE = "extension_manager";
const METADATA_KEY = "metadata";
const DESIRED_STATE_KEY = "desired_state";

const ENABLE_EXTENSION_KEY_PREFIX = "enable:";
const DISABLE_EXTENSION_KEY_PREFIX = "disable:";


/**
 * Handles extension management IPC and sharing of data/state between the main
 * and render/window processes.
 */
export class ExtensionManagerIpc {
  #sharedMap: SharedMap = null;
  #onDesiredStateChangeEventEmitter = new EventEmitter<void>();

  onDesiredStateChange: Event<void>;

  #onEnableExtensionEventEmitter = new EventEmitter<string>();
  onEnableExtension: Event<string>;

  #onDisableExtensionEventEmitter = new EventEmitter<string>();
  onDisableExtension: Event<string>;

  constructor(sharedMap: SharedMap) {
    this.#sharedMap = sharedMap;
    this.onDesiredStateChange = this.#onDesiredStateChangeEventEmitter.event;
    this.onEnableExtension = this.#onEnableExtensionEventEmitter.event;
    this.onDisableExtension = this.#onDisableExtensionEventEmitter.event;

    this.#sharedMap.onChange((ev: ChangeEvent) => {
      if (ev.namespace !== EXTENSION_NAMESPACE) {
        return;
      }
      const key = ev.key;

      if (key === DESIRED_STATE_KEY) {
        this.#onDesiredStateChangeEventEmitter.fire();
        return;
      }

      if (ev.type === ChangeType.ADDED) {
        if (key.startsWith(ENABLE_EXTENSION_KEY_PREFIX)) {
          this.#sharedMap.delete(EXTENSION_NAMESPACE, ev.key);
          this.#onEnableExtensionEventEmitter.fire(ev.value);
          return;
        }
        if (key.startsWith(DISABLE_EXTENSION_KEY_PREFIX)) {
          this.#sharedMap.delete(EXTENSION_NAMESPACE, ev.key);
          this.#onDisableExtensionEventEmitter.fire(ev.value);
          return;
        }
      }
    });
  }

  getExtensionMetadata(): ExtensionMetadata[] {
    return this.#sharedMap.get(EXTENSION_NAMESPACE, METADATA_KEY);
  }

  setExtensionMetadata(metadata: ExtensionMetadata[]): void {
    this.#sharedMap.set(EXTENSION_NAMESPACE, METADATA_KEY, metadata);
  }

  getDesiredState(): ExtensionDesiredState {
    return this.#sharedMap.get(EXTENSION_NAMESPACE, DESIRED_STATE_KEY);
  }

  setDesiredState(desiredState: ExtensionDesiredState): void {
    this.#sharedMap.set(EXTENSION_NAMESPACE, DESIRED_STATE_KEY, desiredState);
  }

  enableExtension(name: string): void {
    this.#sharedMap.set(EXTENSION_NAMESPACE, ENABLE_EXTENSION_KEY_PREFIX + createUuid(), name);
  }

  disableExtension(name: string): void {
    this.#sharedMap.set(EXTENSION_NAMESPACE, DISABLE_EXTENSION_KEY_PREFIX + createUuid(), name);
  }
}
