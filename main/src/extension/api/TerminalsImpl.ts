/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes.js";


export class TerminalsImpl implements ExtensionApi.Terminals {

  #internalExtensionContext: InternalExtensionContext;

  constructor(internalExtensionContext: InternalExtensionContext) {
    this.#internalExtensionContext = internalExtensionContext;
  }

  get onDidCreateTerminal(): ExtensionApi.Event<ExtensionApi.Terminal> {
    return this.#internalExtensionContext.onDidCreateTerminal;
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#internalExtensionContext.getAllTerminals();
  }
}
