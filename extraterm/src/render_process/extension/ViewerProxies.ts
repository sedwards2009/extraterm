/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from '../DomUtils';
import * as ExtensionApi from 'extraterm-extension-api';
import {ProxyFactory} from './InternalTypes';
import {ViewerElement} from '../viewers/ViewerElement';
import {EtTerminal} from '../Terminal';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalViewer';
import {TextViewer} from'../viewers/TextViewer';
import {WorkspaceProxy} from './Proxies';


abstract class ViewerProxy implements ExtensionApi.ViewerBase {

  viewerType: string;

  constructor(public _proxyFactory: ProxyFactory, public _viewer: ViewerElement) {
  }

  getTab(): ExtensionApi.Tab {
    const terminal = this._getOwningEtTerminal();
    return terminal == null ? null : this._proxyFactory.getTabProxy(terminal);
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

  getOwningTerminal(): ExtensionApi.Terminal {
    const terminal = this._getOwningEtTerminal();
    return terminal == null ? null : this._proxyFactory.getTerminalProxy(terminal);
  }
}

export class TerminalOutputProxy extends ViewerProxy implements ExtensionApi.TerminalOutputViewer {

  viewerType: 'terminal-output' = 'terminal-output';

  constructor(public _proxyFactory: ProxyFactory, private _terminalViewer: TerminalViewer) {
    super(_proxyFactory, _terminalViewer);
  }

  isLive(): boolean {
    return this._terminalViewer.getEmulator() != null;
  }
}


export class FrameViewerProxy extends ViewerProxy implements ExtensionApi.FrameViewer {

  viewerType: 'frame' = 'frame';

  constructor(public _proxyFactory: ProxyFactory, private _embeddedViewer: EmbeddedViewer) {
    super(_proxyFactory, _embeddedViewer);
  }

  getContents(): ExtensionApi.Viewer {
    const viewerElement = this._embeddedViewer.getViewerElement();
    if (viewerElement !== null) {
      return this._proxyFactory.getViewerProxy(viewerElement);
    }
    return null; 
  }
}


export class TextViewerProxy extends ViewerProxy implements ExtensionApi.TextViewer {

  viewerType: 'text' = 'text';

  constructor(_proxyFactory: ProxyFactory, private _textViewer: TextViewer) {
    super(_proxyFactory, _textViewer);
  }
  
  getTabSize(): number {
    return this._textViewer.getTabSize();
  }

  setTabSize(size: number): void {
    this._textViewer.setTabSize(size);
  }

  getMimeType():string {
    return this._textViewer.getMimeType();
  }

  setMimeType(mimeType: string): void {
    this._textViewer.setMimeType(mimeType);
  }
}
