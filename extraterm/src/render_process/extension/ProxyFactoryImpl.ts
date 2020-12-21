/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { EtTerminal } from "../Terminal";
import { EtViewerTab } from "../ViewerTab";
import { InternalExtensionContext, ProxyFactory } from "./InternalTypes";
import { TerminalProxy } from "./proxy/TerminalProxy";
import { TerminalTabProxy } from "./proxy/TerminalTabProxy";
import { ViewerElement } from "../viewers/ViewerElement";
import { ViewerTabProxy } from "./proxy/ViewerTabProxy";
import { BlockImpl } from "./BlockImpl";

/**
 * Each extension has its own instance of this. It holds and gathers all of
 * the proxy object instances and allows for mapping internal application
 * objects to proxies for use in the extension API.
 */
export class ProxyFactoryImpl implements ProxyFactory {

  private _terminalTabProxyMap = new Map<EtTerminal, ExtensionApi.Tab>();
  private _viewerTabProxyMap = new Map<EtViewerTab, ExtensionApi.Tab>();
  private _terminalProxyMap = new Map<EtTerminal, ExtensionApi.Terminal>();
  private _blockMap = new Map<ViewerElement, ExtensionApi.Block>();

  constructor(private _internalExtensionContext: InternalExtensionContext) {
  }

  getTabProxy(tabLike: EtTerminal | EtViewerTab): ExtensionApi.Tab {
    if (tabLike == null) {
      return null;
    }
    if (tabLike instanceof EtTerminal) {
      if ( ! this._terminalTabProxyMap.has(tabLike)) {
        const proxy = new TerminalTabProxy(this._internalExtensionContext, tabLike);
        tabLike.onDispose(() => {
          this._terminalTabProxyMap.delete(tabLike);
        });
        this._terminalTabProxyMap.set(tabLike, proxy);
      }
      return this._terminalTabProxyMap.get(tabLike);
    }

    if (tabLike instanceof EtViewerTab) {
      if ( ! this._viewerTabProxyMap.has(tabLike)) {
        const proxy = new ViewerTabProxy(this._internalExtensionContext, tabLike);
        tabLike.onDispose(() => {
          this._viewerTabProxyMap.delete(tabLike);
        });
        this._viewerTabProxyMap.set(tabLike, proxy);
      }
      return this._viewerTabProxyMap.get(tabLike);
    }
    return null;
  }

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal {
    if (terminal == null) {
      return null;
    }
    if ( ! this._terminalProxyMap.has(terminal)) {
      const proxy = new TerminalProxy(this._internalExtensionContext, terminal);
      terminal.onDispose(() => {
        this._terminalProxyMap.delete(terminal);
      });
      this._terminalProxyMap.set(terminal, proxy);
    }
    return this._terminalProxyMap.get(terminal);
  }

  hasTerminalProxy(terminal: EtTerminal): boolean {
    return this._terminalProxyMap.has(terminal);
  }

  getBlock(viewer: ViewerElement): ExtensionApi.Block {
    if (viewer == null) {
      return null;
    }
    if ( ! this._blockMap.has(viewer)) {
      const block = new BlockImpl(this._internalExtensionContext, viewer);
      if (block === null) {
        return null;
      }
      viewer.onDispose(() => {
        this._blockMap.delete(viewer);
      });
      this._blockMap.set(viewer, block);
    }
    return this._blockMap.get(viewer);
  }
}
