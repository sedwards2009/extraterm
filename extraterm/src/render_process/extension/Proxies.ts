import * as ExtensionApi from 'extraterm-extension-api';
import {EtTerminal, EXTRATERM_COOKIE_ENV} from '../Terminal';
import {InternalExtensionContext} from './InternalInterfaces';
import {Logger, getLogger} from '../../logging/Logger';
import { SimpleViewerElement } from '../viewers/SimpleViewerElement';


interface RegisteredViewer {
  tag: string;
  mimeTypes: string[];
}

export class WorkspaceProxy implements ExtensionApi.Workspace {
  private _log: Logger = null;
  private _registeredViewers: RegisteredViewer[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceProxy", this);
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  getTerminals(): ExtensionApi.Terminal[] {
    return this._internalExtensionContext.extensionBridge.workspaceGetTerminals()
      .map(terminal => this._internalExtensionContext.getTerminalProxy(terminal));
  }

  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._internalExtensionContext.extensionBridge.registerOnDidCreateTerminalListener(this._internalExtensionContext,
      listener);
  }

  registerCommandsOnTerminal(
      commandLister: (terminal: ExtensionApi.Terminal) => ExtensionApi.CommandEntry[],
      commandExecutor: (terminal: ExtensionApi.Terminal, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._internalExtensionContext.extensionBridge.registerCommandsOnTerminal(this._internalExtensionContext,
      {commandLister, commandExecutor});
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._internalExtensionContext.extensionBridge.registerCommandsOnTextViewer(this._internalExtensionContext,
      {commandLister, commandExecutor});
  }

  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor, mimeTypes: string[]): void {
    const viewerElementProxyClass = class extends ExtensionViewerProxy {
      protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
        return new viewerClass();
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, viewerElementProxyClass);

    this._registeredViewers.push({
      mimeTypes, tag
    });
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (const registeredViewer of this._registeredViewers) {
      if (registeredViewer.mimeTypes.indexOf(mimeType) !== -1) {
        return registeredViewer.tag;
      }
    }
    return null;
  }
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionViewerBaseImpl implements ExtensionApi.ExtensionViewerBase {
  constructor() {
    console.log("ExtensionViewerBaseImpl()");
  }
}


class ExtensionViewerProxy extends SimpleViewerElement {
  private _extensionViewer: ExtensionApi.ExtensionViewerBase = null;

  constructor() {
    super();
    this._extensionViewer = this._createExtensionViewer();

    
  }

  protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
    return null;  
  }
}


export class TerminalTabProxy implements ExtensionApi.Tab {

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionBridge.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionBridge.showListPicker(this._terminal, options);
  }
}


export class TerminalProxy implements ExtensionApi.Terminal {
  
  viewerType: 'terminal-output';

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
  }

  getTab(): ExtensionApi.Tab {
    return this._internalExtensionContext.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  getViewers(): ExtensionApi.Viewer[] {
    return this._terminal.getViewerElements().map(viewer => this._internalExtensionContext.getViewerProxy(viewer));
  }

  getExtratermCookieValue(): string {
    return this._terminal.getExtratermCookieValue();
  }

  getExtratermCookieName(): string{
    return EXTRATERM_COOKIE_ENV;
  }
}
