/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../../InternalTypes.js";


export class SessionsImpl implements ExtensionApi.Sessions {

  #internalExtensionContext: InternalExtensionContext;

  constructor(internalExtensionContext: InternalExtensionContext) {
    this.#internalExtensionContext = internalExtensionContext;
  }

  registerSessionBackend(type: string, backend: ExtensionApi.SessionBackend): void {
    this.#internalExtensionContext.registerSessionBackend(type, backend);
  }

  registerSessionEditor(type: string, factory: ExtensionApi.SessionEditorFactory): void {
    this.#internalExtensionContext.sessionEditorRegistry.registerSessionEditor(type, factory);
  }

  registerSessionSettingsEditor(id: string, factory: ExtensionApi.SessionSettingsEditorFactory): void {
    this.#internalExtensionContext.sessionSettingsEditorRegistry.registerSessionSettingsEditor(id, factory);
  }
}
