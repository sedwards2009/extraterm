/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import {ExtensionUiUtils, ProxyFactory} from './InternalTypes';
import {TerminalProxy, TerminalTabProxy} from './Proxies';
import {EtTerminal} from '../Terminal';
import {FrameViewerProxy, TerminalOutputProxy, TextViewerProxy} from './ViewerProxies';
import {ViewerElement} from '../viewers/ViewerElement';
import {TextViewer} from'../viewers/TextViewer';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalViewer';


export class ProxyFactoryImpl implements ProxyFactory {
  private _tabProxyMap = new WeakMap<EtTerminal, ExtensionApi.Tab>();
  private _terminalProxyMap = new WeakMap<EtTerminal, ExtensionApi.Terminal>();
  private _viewerProxyMap = new WeakMap<ViewerElement, ExtensionApi.Viewer>();

  constructor(public extensionUiUtils: ExtensionUiUtils) {
  }

  getTabProxy(terminal: EtTerminal): ExtensionApi.Tab {
    if ( ! this._tabProxyMap.has(terminal)) {
      this._tabProxyMap.set(terminal, new TerminalTabProxy(this, this.extensionUiUtils, terminal));
    }
    return this._tabProxyMap.get(terminal);
  }

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal {
    if ( ! this._terminalProxyMap.has(terminal)) {
      this._terminalProxyMap.set(terminal, new TerminalProxy(this, terminal));
    }
    return this._terminalProxyMap.get(terminal);
  }

  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
    if ( ! this._viewerProxyMap.has(viewer)) {
      const proxy = this._createViewerProxy(viewer);
      if (proxy === null) {
        return null;
      }
      this._viewerProxyMap.set(viewer, proxy);
    }
    return this._viewerProxyMap.get(viewer);
  }

  private _createViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
      if (viewer instanceof TerminalViewer) {
        return new TerminalOutputProxy(this, viewer);
      }
      if (viewer instanceof TextViewer) {
        return new TextViewerProxy(this, viewer);
      }
      if (viewer instanceof EmbeddedViewer) {
        return new FrameViewerProxy(this, viewer);
      }
      return null;
  }
}
