/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from "../../DomUtils";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { EtTerminal } from "../../Terminal";
import { EtViewerTab } from "../../ViewerTab";
import { InternalExtensionContext } from "../InternalTypes";
import { ViewerElement } from "../../viewers/ViewerElement";


export abstract class AbstractViewerProxy implements ExtensionApi.ViewerBase {

  viewerType: string;

  constructor(protected _internalExtensionContext: InternalExtensionContext, public _viewer: ViewerElement) {
  }

  getTab(): ExtensionApi.Tab {
    const terminal = this._getOwningEtTerminal();
    if (terminal != null) {
      return this._internalExtensionContext.proxyFactory.getTabProxy(terminal);
    }
    const viewerTab = this._getOwningEtViewerTab();
    if (viewerTab != null) {
      return this._internalExtensionContext.proxyFactory.getTabProxy(viewerTab);
    }
    return null;
  }

  private _getOwningEtTerminal(): EtTerminal {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtTerminal) {
        return node;
      }
    }
    return null;
  }

  private _getOwningEtViewerTab(): EtViewerTab {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtViewerTab) {
        return node;
      }
    }
    return null;
  }

  getOwningTerminal(): ExtensionApi.Terminal {
    const terminal = this._getOwningEtTerminal();
    return terminal == null ? null : this._internalExtensionContext.proxyFactory.getTerminalProxy(terminal);
  }
}

