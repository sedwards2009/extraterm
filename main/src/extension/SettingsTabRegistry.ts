/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, getLogger } from "extraterm-logging";

import { ExtensionSettingsTabContribution, ExtensionMetadata } from "./ExtensionMetadata.js";
import { InternalExtensionContext } from "../InternalTypes.js";

export interface LoadedSettingsTabContribution {
  metadata: ExtensionSettingsTabContribution;
  factory: ExtensionApi.SettingsTabFactory;
}


export class SettingsTabRegistry {
  private _log: Logger = null;

  #internalExtensionContext: InternalExtensionContext;
  #extensionMetadata: ExtensionMetadata;
  #contributions: LoadedSettingsTabContribution[] = [];

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("BlockRegistry", this);
    this.#internalExtensionContext = internalExtensionContext;
    this.#extensionMetadata = extensionMetadata;
  }

  registerSettingsTab(name: string, factory: ExtensionApi.SettingsTabFactory): void {
    for (const metadata of this.#extensionMetadata.contributes.settingsTabs) {
      if (metadata.name === name) {
        this.#contributions.push({
          metadata: metadata,
          factory: factory
        });
        return;
      }
    }

    this._log.warn(`Unable to register settings tab '${name}' for extension ` +
      `'${this.#extensionMetadata.name}' because the settings tab contribution data ` +
      `couldn't be found in the extension's package.json file.`);
  }

  getSettingsTabContributions(): LoadedSettingsTabContribution[] {
    return [...this.#contributions];
  }
}
