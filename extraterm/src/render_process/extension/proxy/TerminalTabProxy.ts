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
    this._terminal.onDispose(this._handleTerminalDispose.bind(this));
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("Terminal is not alive and can no longer be used.");
    }
  }

  private _handleTerminalDispose(): void {
    this._terminal = null;
  }

  isAlive(): boolean {
    return this._terminal != null;
  }

  getTerminal(): ExtensionApi.Terminal {
    this._checkIsAlive();
    return this._internalExtensionContext._proxyFactory.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    this._checkIsAlive();
    return this._internalExtensionContext._extensionManager.extensionUiUtils.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    this._checkIsAlive();
    return this._internalExtensionContext._extensionManager.extensionUiUtils.showListPicker(this._terminal, options);
  }
}
