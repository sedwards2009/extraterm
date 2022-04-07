/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { InternalExtensionContext } from "../../InternalTypes.js";
import { Tab } from "../../Tab.js";


export class TabImpl implements ExtensionApi.Tab {

  #internalExtensionContext: InternalExtensionContext;
  #tab: Tab;

  constructor(internalExtensionContext: InternalExtensionContext, tab: Tab) {
    this.#internalExtensionContext = internalExtensionContext;
    this.#tab = tab;
  }

  get terminal(): ExtensionApi.Terminal {
    return null;
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number> {
    throw new Error("Method not implemented.");
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number> {
    return this.#internalExtensionContext.showListPicker(this.#tab, options);
  }

  get isAlive(): boolean {
    return true;
  }

  get window(): ExtensionApi.Window {
    return this.#internalExtensionContext.getWindowForTab(this.#tab);
  }
}
