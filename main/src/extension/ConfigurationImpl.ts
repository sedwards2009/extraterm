/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { ConfigChangeEvent, ConfigDatabase } from "../config/ConfigDatabase";


export class ConfigurationImpl implements ExtensionApi.Configuration, ExtensionApi.Disposable {
  #configDatabase: ConfigDatabase = null;

  onChange: ExtensionApi.Event<void>;
  #onChangeEventEmitter = new EventEmitter<void>();
  #extensionName: string = null;

  #onExtensionChangeDisposable: ExtensionApi.Disposable = null;

  constructor(configDatabase: ConfigDatabase, extensionName: string) {
    this.#configDatabase = configDatabase;
    this.#extensionName = extensionName;
    this.onChange = this.#onChangeEventEmitter.event;

    this.#onExtensionChangeDisposable = this.#configDatabase.onExtensionChange((ev: ConfigChangeEvent) => {
      if (ev.key !== this.#extensionName) {
        return;
      }
      this.#onChangeEventEmitter.fire();
    });
  }

  dispose(): void {
    this.#onExtensionChangeDisposable.dispose();
  }

  get(): any {
    return this.#configDatabase.getExtensionConfig(this.#extensionName);
  }

  set(config: any): void {
    this.#configDatabase.setExtensionConfig(this.#extensionName, config);
  }
}
