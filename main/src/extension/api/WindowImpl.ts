/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes";
import { Window } from "../../Window";
import { ExtensionMetadata } from "../ExtensionMetadata";
import { ExtensionTabBridge } from "./ExtensionTabImpl";


export class WindowImpl implements ExtensionApi.Window {

  #internalExtensionContext: InternalExtensionContext;
  #window: Window;

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      window: Window) {

    this.#internalExtensionContext = internalExtensionContext;
    this.#window = window;
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#window.getTerminals().map(t => this.#internalExtensionContext.wrapTerminal(t));
  }

  onDidClose: ExtensionApi.Event<ExtensionApi.Window>;

  createExtensionTab(name: string): ExtensionApi.ExtensionTab {

    const bridge = new ExtensionTabBridge(this.#window);
    return bridge.getExtensionTabImpl();
  }
}
