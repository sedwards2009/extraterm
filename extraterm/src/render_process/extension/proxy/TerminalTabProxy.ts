/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EtTerminal } from "../../Terminal";
import { InternalExtensionContext } from "../InternalTypes";


export class TerminalTabProxy implements ExtensionApi.Tab {

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.proxyFactory.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showListPicker(this._terminal, options);
  }
}
