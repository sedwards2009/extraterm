/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { EmbeddedViewer } from "../viewers/EmbeddedViewer";
import { EtTerminal } from "../Terminal";
import { EtViewerTab } from "../ViewerTab";
import { FrameViewerProxy } from "./proxy/FrameViewerProxy";
import { InternalExtensionContext, ProxyFactory } from "./InternalTypes";
import { TerminalOutputProxy } from "./proxy/TerminalOutputProxy";
import { TerminalProxy } from "./proxy/TerminalProxy";
import { TerminalTabProxy } from "./proxy/TerminalTabProxy";
import { TerminalViewer } from "../viewers/TerminalAceViewer";
import { TextViewer } from"../viewers/TextAceViewer";
import { TextViewerProxy } from "./proxy/TextViewerProxy";
import { ViewerElement } from "../viewers/ViewerElement";
import { ViewerTabProxy } from "./proxy/ViewerTabProxy";

/**
 * Each extension has its own instance of this. It holds and gathers all of
 * the proxy object instances and allows for mapping internal application
 * objects to proxies for use in the extension API.
 */
export class ProxyFactoryImpl implements ProxyFactory {

  private _terminalTabProxyMap = new Map<EtTerminal, ExtensionApi.Tab>();
  private _viewerTabProxyMap = new Map<EtViewerTab, ExtensionApi.Tab>();
  private _terminalProxyMap = new Map<EtTerminal, ExtensionApi.Terminal>();
  private _viewerProxyMap = new Map<ViewerElement, ExtensionApi.Viewer>();

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

  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
    if (viewer == null) {
      return null;
    }
    if ( ! this._viewerProxyMap.has(viewer)) {
      const proxy = this._createViewerProxy(viewer);
      if (proxy === null) {
        return null;
      }
      viewer.onDispose(() => {
        this._viewerProxyMap.delete(viewer);
      });
      this._viewerProxyMap.set(viewer, proxy);
    }
    return this._viewerProxyMap.get(viewer);
  }

  private _createViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
    if (viewer instanceof TerminalViewer) {
      return new TerminalOutputProxy(this._internalExtensionContext, viewer);
    }
    if (viewer instanceof TextViewer) {
      return new TextViewerProxy(this._internalExtensionContext, viewer);
    }
    if (viewer instanceof EmbeddedViewer) {
      return new FrameViewerProxy(this._internalExtensionContext, viewer);
    }
    return null;
  }
}
