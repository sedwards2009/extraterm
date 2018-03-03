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
import {TextViewer} from'../viewers/TextViewer';
import {ProxyFactoryImpl} from './ProxyFactoryImpl';
import {ExtensionManager, ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalInterfaces';
import {ExtensionUiUtilsImpl} from './ExtensionUiUtilsImpl';
import {WorkspaceProxy} from './Proxies';


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
  private _proxyFactory: ProxyFactory = null;

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../../../../extensions" )]);
    this._extensionUiUtils = new ExtensionUiUtilsImpl();
    this._proxyFactory = new ProxyFactoryImpl(this._extensionUiUtils);
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
        const extensionContextImpl = new InternalExtensionContextImpl(this._extensionUiUtils, extensionMetadata,
                                      this._proxyFactory);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }
}


class InternalExtensionContextImpl implements InternalExtensionContext {
  workspace: InternalWorkspace = null;
  internalWorkspace: InternalWorkspace = null;
  codeMirrorModule: typeof CodeMirror = CodeMirror;
  logger: ExtensionApi.Logger = null;

  constructor(public extensionUiUtils: ExtensionUiUtils, public extensionMetadata: ExtensionMetadata, public proxyFactory: ProxyFactory) {
    this.workspace = new WorkspaceProxy(this);
    this.internalWorkspace = this.workspace;
    this.logger = getLogger(extensionMetadata.name);
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWorkspace.findViewerElementTagByMimeType(mimeType);
  }
}
