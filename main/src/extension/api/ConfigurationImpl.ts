/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { ConfigChangeEvent, ConfigDatabase } from "../../config/ConfigDatabase.js";


export class ConfigurationImpl implements ExtensionApi.Configuration, ExtensionApi.Disposable {
  #configDatabase: ConfigDatabase = null;

  #extensionName: string = null;

  constructor(configDatabase: ConfigDatabase, extensionName: string) {
    this.#configDatabase = configDatabase;
    this.#extensionName = extensionName;
  }

  dispose(): void {
  }

  get(): any {
    return this.#configDatabase.getExtensionConfig(this.#extensionName);
  }

  set(config: any): void {
    this.#configDatabase.setExtensionConfig(this.#extensionName, config);
  }
}
