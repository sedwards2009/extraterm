/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ConfigDatabase } from "../../config/ConfigDatabase";
import { InternalExtensionContext } from "../../InternalTypes";
import { Window } from "../../Window";
import { ExtensionMetadata } from "../ExtensionMetadata";
import { ExtensionTabBridge } from "./ExtensionTabImpl";
import { StyleImpl } from "./StyleImpl";


export class WindowImpl implements ExtensionApi.Window {

  #internalExtensionContext: InternalExtensionContext;
  #window: Window;
  #style: ExtensionApi.Style;

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      window: Window, configDatabase: ConfigDatabase) {

    this.#internalExtensionContext = internalExtensionContext;
    this.#window = window;
    this.#style = new StyleImpl(window, configDatabase);
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#window.getTerminals().map(t => this.#internalExtensionContext.wrapTerminal(t));
  }

  onDidClose: ExtensionApi.Event<ExtensionApi.Window>;

  createExtensionTab(name: string): ExtensionApi.ExtensionTab {
    const bridge = new ExtensionTabBridge(this.#window);
    return bridge.getExtensionTabImpl();
  }

  get style(): ExtensionApi.Style {
    return this.#style;
  }
}
