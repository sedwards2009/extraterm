/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Event } from "@extraterm/extraterm-extension-api";
import { ExtensionDesiredState, ExtensionMetadata } from "./ExtensionMetadata";
import { SharedMap, ChangeEvent } from "./shared_map/SharedMap";
import { EventEmitter } from "extraterm-event-emitter";

const EXTENSION_NAMESPACE = "extension_manager";
const METADATA_KEY = "metadata";
const DESIRED_STATE_KEY = "desired_state";

export class ExtensionManagerIpc {
  #sharedMap: SharedMap = null;
  #onDesiredStateChangeEventEmitter = new EventEmitter<void>();

  onDesiredStateChange: Event<void>;

  constructor(sharedMap: SharedMap) {
    this.#sharedMap = sharedMap;
    this.onDesiredStateChange = this.#onDesiredStateChangeEventEmitter.event;

    this.#sharedMap.onChange((ev: ChangeEvent) => {
      if (ev.namespace !== EXTENSION_NAMESPACE) {
        return;
      }
      if (ev.key === DESIRED_STATE_KEY) {
        this.#onDesiredStateChangeEventEmitter.fire();
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
}
