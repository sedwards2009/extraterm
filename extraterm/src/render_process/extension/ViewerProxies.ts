/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from '../DomUtils';
import * as ExtensionApi from 'extraterm-extension-api';
import {ProxyFactory, InternalExtensionContext} from './InternalTypes';
import {ViewerElement} from '../viewers/ViewerElement';
import {EtTerminal} from '../Terminal';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalAceViewer';
import {TextViewer} from'../viewers/TextAceViewer';
import { EtViewerTab } from '../ViewerTab';


abstract class ViewerProxy implements ExtensionApi.ViewerBase {

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

export class TerminalOutputProxy extends ViewerProxy implements ExtensionApi.TerminalOutputViewer {

  viewerType: 'terminal-output' = 'terminal-output';

  constructor(internalExtensionContext: InternalExtensionContext, private _terminalViewer: TerminalViewer) {
    super(internalExtensionContext, _terminalViewer);
  }

  isLive(): boolean {
    return this._terminalViewer.getEmulator() != null;
  }

  find(needle: string): void {
    this._terminalViewer.find(needle);
  }

  findNext(needle: string): void {
    this._terminalViewer.findNext(needle);
  }

  findPrevious(needle: string): void {
    this._terminalViewer.findPrevious(needle);
  }
}


export class FrameViewerProxy extends ViewerProxy implements ExtensionApi.FrameViewer {

  viewerType: 'frame' = 'frame';

  constructor(internalExtensionContext: InternalExtensionContext, private _embeddedViewer: EmbeddedViewer) {
    super(internalExtensionContext, _embeddedViewer);
  }

  getContents(): ExtensionApi.Viewer {
    const viewerElement = this._embeddedViewer.getViewerElement();
    if (viewerElement !== null) {
      return this._internalExtensionContext.proxyFactory.getViewerProxy(viewerElement);
    }
    return null; 
  }
}


export class TextViewerProxy extends ViewerProxy implements ExtensionApi.TextViewer {

  viewerType: 'text' = 'text';

  constructor(internalExtensionContext: InternalExtensionContext, private _textViewer: TextViewer) {
    super(internalExtensionContext, _textViewer);
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

  getShowLineNumbers(): boolean {
    return this._textViewer.getShowLineNumbers();
  }

  setShowLineNumbers(show: boolean): void {
    this._textViewer.setShowLineNumbers(show);
  }

  getWrapLines(): boolean {
    return this._textViewer.getWrapLines();
  }

  setWrapLines(wrap: boolean): void {
    this._textViewer.setWrapLines(wrap);
  }
}
