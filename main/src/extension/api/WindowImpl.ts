/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ConfigDatabase } from "../../config/ConfigDatabase.js";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { Window } from "../../Window.js";
import { ExtensionMetadata } from "../ExtensionMetadata.js";
import { ExtensionTabBridge } from "./ExtensionTabImpl.js";
import { StyleImpl } from "./StyleImpl.js";


export class WindowImpl implements ExtensionApi.Window {
  #log: ExtensionApi.Logger = null;
  #internalExtensionContext: InternalExtensionContext;
  #window: Window;
  #style: ExtensionApi.Style;

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      window: Window, configDatabase: ConfigDatabase, log: ExtensionApi.Logger) {
    this.#log = log;
    this.#internalExtensionContext = internalExtensionContext;
    this.#window = window;
    this.#style = new StyleImpl(configDatabase, window);
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#window.getTerminals().map(t => this.#internalExtensionContext.wrapTerminal(t));
  }

  onDidClose: ExtensionApi.Event<ExtensionApi.Window>;

  createExtensionTab(name: string): ExtensionApi.ExtensionTab {
    const bridge = new ExtensionTabBridge(this.#internalExtensionContext, this.#window, this.#log);
    return bridge.getExtensionTabImpl();
  }

  get style(): ExtensionApi.Style {
    return this.#style;
  }
}
