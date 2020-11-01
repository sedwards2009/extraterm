/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../InternalTypes";
import { EtViewerTab } from "../../ViewerTab";


export class ViewerTabProxy implements ExtensionApi.Tab {
  constructor(private _internalExtensionContext: InternalExtensionContext, private _viewerTab: EtViewerTab) {
    this._viewerTab.onDispose(this._handleViewerTabDispose.bind(this));
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("Terminal is not alive and can no longer be used.");
    }
  }

  private _handleViewerTabDispose(): void {
    this._viewerTab = null;
  }

  isAlive(): boolean {
    return this._viewerTab != null;
  }

  getTerminal(): ExtensionApi.Terminal {
    this._checkIsAlive();
    return null;
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    this._checkIsAlive();
    return this._internalExtensionContext._extensionManager.extensionUiUtils.showNumberInput(this._viewerTab, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    this._checkIsAlive();
    return this._internalExtensionContext._extensionManager.extensionUiUtils.showListPicker(this._viewerTab, options);
  }
}
