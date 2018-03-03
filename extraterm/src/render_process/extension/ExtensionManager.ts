/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as CodeMirror from 'codemirror';
import * as path from 'path';
import * as _ from 'lodash';
import * as ExtensionApi from 'extraterm-extension-api';

import {Logger, getLogger} from '../../logging/Logger';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {EtTerminal} from '../Terminal';
import {ViewerElement} from '../viewers/ViewerElement';
import {TextViewer} from'../viewers/TextViewer';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalViewer';
import {ExtensionManager, ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalInterfaces';
import {FrameViewerProxy, TerminalOutputProxy, TextViewerProxy} from './ViewerProxies';
import {TerminalProxy, TerminalTabProxy, WorkspaceProxy} from './Proxies';
import {ExtensionUiUtilsImpl} from './ExtensionUiUtilsImpl';


interface ActiveExtension {
  extensionMetadata: ExtensionMetadata;
  extensionContextImpl: InternalExtensionContext;
  extensionPublicApi: any;
}


export class ExtensionManagerImpl implements ExtensionManager {
  private _log: Logger = null;
  private _extensionLoader: ExtensionLoader = null;
  private _activeExtensions: ActiveExtension[] = [];
  private _extensionUiUtils: ExtensionUiUtils = null;

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../../../../extensions" )]);
    this._extensionUiUtils = new ExtensionUiUtilsImpl();
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      this._startExtension(extensionInfo);
    }
  }

  getWorkspaceTerminalCommands(terminal: EtTerminal): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const ownerExtensionContext = activeExtension.extensionContextImpl;
        const terminalProxy = ownerExtensionContext.proxyFactory.getTerminalProxy(terminal);
        return activeExtension.extensionContextImpl.internalWorkspace.getTerminalCommands(
          activeExtension.extensionMetadata.name, terminalProxy);
      }));
  }

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const extensionContext = activeExtension.extensionContextImpl;
        const textViewerProxy = <ExtensionApi.TextViewer> extensionContext.proxyFactory.getViewerProxy(textViewer);
        return extensionContext.internalWorkspace.getTextViewerCommands(
          activeExtension.extensionMetadata.name, textViewerProxy);
      }));
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (let extension of this._activeExtensions) {
      const tag = extension.extensionContextImpl.findViewerElementTagByMimeType(mimeType);
      if (tag !== null) {
        return tag;
      }
    }
    return null;
  }

  private _startExtension(extensionMetadata: ExtensionMetadata): void {
    if (this._extensionLoader.load(extensionMetadata)) {
      try {
        const extensionContextImpl = new InternalExtensionContextImpl(this._extensionUiUtils, extensionMetadata);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }
}


class InternalExtensionContextImpl implements InternalExtensionContext, ProxyFactory {
  workspace: InternalWorkspace = null;
  internalWorkspace: InternalWorkspace = null;
  codeMirrorModule: typeof CodeMirror = CodeMirror;
  logger: ExtensionApi.Logger = null;
  proxyFactory: ProxyFactory = null;

  private _tabProxyMap = new WeakMap<EtTerminal, ExtensionApi.Tab>();
  private _terminalProxyMap = new WeakMap<EtTerminal, ExtensionApi.Terminal>();
  private _viewerProxyMap = new WeakMap<ViewerElement, ExtensionApi.Viewer>();

  constructor(public extensionUiUtils: ExtensionUiUtils, public extensionMetadata: ExtensionMetadata) {
    this.workspace = new WorkspaceProxy(this);
    this.internalWorkspace = this.workspace;
    this.logger = getLogger(extensionMetadata.name);
    this.proxyFactory = this;
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

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWorkspace.findViewerElementTagByMimeType(mimeType);
  }
}
