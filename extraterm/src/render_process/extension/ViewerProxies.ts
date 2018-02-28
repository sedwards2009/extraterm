import * as DomUtils from '../DomUtils';
import * as ExtensionApi from 'extraterm-extension-api';
import {ExtensionBridge, InternalExtensionContext, CommandRegistration} from './InternalInterfaces';
import {ViewerElement} from '../viewers/ViewerElement';
import {EtTerminal} from '../Terminal';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalViewer';
import {TextViewer} from'../viewers/TextViewer';


abstract class ViewerProxy implements ExtensionApi.ViewerBase {

  viewerType: string;

  constructor(public _internalExtensionContext: InternalExtensionContext, public _viewer: ViewerElement) {
  }

  getTab(): ExtensionApi.Tab {
    const terminal = this._getOwningEtTerminal();
    return terminal == null ? null : this._internalExtensionContext.getTabProxy(terminal);
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
    return terminal == null ? null : this._internalExtensionContext.getTerminalProxy(terminal);
  }
}

export class TerminalOutputProxy extends ViewerProxy implements ExtensionApi.TerminalOutputViewer {

  viewerType: 'terminal-output' = 'terminal-output';

  constructor(public _internalExtensionContext: InternalExtensionContext, private _terminalViewer: TerminalViewer) {
    super(_internalExtensionContext, _terminalViewer);
  }

  isLive(): boolean {
    return this._terminalViewer.getEmulator() != null;
  }
}


export class FrameViewerProxy extends ViewerProxy implements ExtensionApi.FrameViewer {

  viewerType: 'frame' = 'frame';

  constructor(public _internalExtensionContext: InternalExtensionContext, private _embeddedViewer: EmbeddedViewer) {
    super(_internalExtensionContext, _embeddedViewer);
  }

  getContents(): ExtensionApi.Viewer {
    const viewerElement = this._embeddedViewer.getViewerElement();
    if (viewerElement !== null) {
      return this._internalExtensionContext.getViewerProxy(viewerElement);
    }
    return null; 
  }
}


export class TextViewerProxy extends ViewerProxy implements ExtensionApi.TextViewer {

  viewerType: 'text' = 'text';

  constructor(_internalExtensionContext: InternalExtensionContext, private _textViewer: TextViewer) {
    super(_internalExtensionContext, _textViewer);
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
