/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {DisposableItemList} from '../../utils/DisposableUtils';
import {EtTerminal, EXTRATERM_COOKIE_ENV} from '../Terminal';
import {ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalTypes';
import {Logger, getLogger} from '../../logging/Logger';
import { SimpleViewerElement } from '../viewers/SimpleViewerElement';
import { ViewerElement } from '../viewers/ViewerElement';
import { ExtensionViewerContribution, ExtensionSessionEditorContribution } from '../../ExtensionMetadata';
import { CssFile } from '../../theme/Theme';
import { ThemeableElementBase } from '../ThemeableElementBase';
import { WorkspaceCommandsRegistry } from './WorkspaceCommandsRegistry';


interface RegisteredViewer {
  tag: string;
  mimeTypes: string[];
}

interface RegisteredSessionEditor {
  type: string;
  tag: string;
}


export class WorkspaceProxy implements InternalWorkspace {
  private _log: Logger = null;
  private _workspaceCommandsRegistry: WorkspaceCommandsRegistry = null;
  private _registeredViewers: RegisteredViewer[] = [];
  private _registeredSessionEditors: RegisteredSessionEditor[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceProxy", this);
    this._workspaceCommandsRegistry = new WorkspaceCommandsRegistry();
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
    this.extensionSessionEditorBaseConstructor = ExtensionSessionEditorBaseImpl;    
  }

  getTerminals(): ExtensionApi.Terminal[] {
    return []; // FIXME
    // return this._internalExtensionContext.extensionBridge.workspaceGetTerminals()
    //   .map(terminal => this._internalExtensionContext.getTerminalProxy(terminal));
  }

  private _onDidCreateTerminalListenerList = new DisposableItemList<(e: ExtensionApi.Terminal) => any>();
  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._onDidCreateTerminalListenerList.add(listener);
  }

  registerCommandsOnTerminal(
      commandLister: (terminal: ExtensionApi.Terminal) => ExtensionApi.CommandEntry[],
      commandExecutor: (terminal: ExtensionApi.Terminal, commandId: string, commandArguments?: object) => void
      ): ExtensionApi.Disposable {

    return this._workspaceCommandsRegistry.registerCommandsOnTerminal(commandLister, commandExecutor);
  }

  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): CommandPaletteRequestTypes.CommandEntry[] {
    return this._workspaceCommandsRegistry.getTerminalCommands(extensionName, terminal);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {
      return this._workspaceCommandsRegistry.registerCommandsOnTextViewer(commandLister, commandExecutor);
  }

  getTextViewerCommands(extensionName: string, textViewer: ExtensionApi.TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return this._workspaceCommandsRegistry.getTextViewerCommands(extensionName, textViewer);
  }

  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    let viewerMetadata: ExtensionViewerContribution = null;
    for (const vmd of this._internalExtensionContext.extensionMetadata.contributions.viewer) {
      if (vmd.name === name) {
        viewerMetadata = vmd;
        break;
      }
    }

    if (viewerMetadata == null) {
      this._log.warn(`Unable to register viewer '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the viewer contribution data couldn't ` +
        `be found in the extension's package.json file.`);
      return;
    }

    const internalExtensionContext = this._internalExtensionContext;

    const viewerElementProxyClass = class extends ExtensionViewerProxy {
      protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
        return new viewerClass(this);
      }

      protected _getExtensionContext(): InternalExtensionContext {
        return internalExtensionContext;
      }
    
      protected _getExtensionViewerContribution(): ExtensionViewerContribution {
        return viewerMetadata;
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, viewerElementProxyClass);

    this._registeredViewers.push({
      mimeTypes: viewerMetadata.mimeTypes, tag
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

  extensionSessionEditorBaseConstructor: ExtensionApi.ExtensionSessionEditorBaseConstructor;

  registerSessionEditor(type: string, sessionEditorClass: ExtensionApi.ExtensionSessionEditorBaseConstructor): void {
    let sessionEditorMetadata: ExtensionSessionEditorContribution = null;
    for (const semd of this._internalExtensionContext.extensionMetadata.contributions.sessionEditor) {
      if (semd.name === name) {
        sessionEditorMetadata = semd;
        break;
      }
    }

    if (sessionEditorMetadata == null) {
      this._log.warn(`Unable to register session editor '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the session editor contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    const internalExtensionContext = this._internalExtensionContext;

    const sessionEditorProxyClass = class extends ExtensionSessionEditorProxy {
      protected _createExtensionSessionEditor(): ExtensionApi.ExtensionSessionEditorBase {
        return new sessionEditorClass(this);
      }

      protected _getExtensionContext(): InternalExtensionContext {
        return internalExtensionContext;
      }
    
      protected _getExtensionViewerContribution(): ExtensionSessionEditorContribution {
        return sessionEditorMetadata;
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-session-editor-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, sessionEditorProxyClass);

    this._registeredSessionEditors.push({
      type: sessionEditorMetadata.type, tag
    });
  }
  
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionViewerProxy extends SimpleViewerElement {
  private _extensionViewer: ExtensionApi.ExtensionViewerBase = null;

  constructor() {
    super();
    this._extensionViewer = this._createExtensionViewer();
    this._extensionViewer.created();
  }

  protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
    return null;
  }

  protected _getExtensionContext(): InternalExtensionContext {
    return null;
  }

  protected _getExtensionViewerContribution(): ExtensionViewerContribution {
    return null;
  }

  protected _themeCssFiles(): CssFile[] {
    const extensionContext = this._getExtensionContext();
    const name = extensionContext.extensionMetadata.name
    const cssDecl = this._getExtensionViewerContribution().css;
    const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + cf);

    const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
    return [CssFile.GUI_CONTROLS, ...fontAwesomeCss, ...cssFiles];
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this._extensionViewer.getMetadata();
  }
  
  _metadataUpdated(): void {
    const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return this._extensionViewer.getBulkFileHandle();
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): void {
    this._extensionViewer.setBulkFileHandle(handle);
  }
}


class ExtensionViewerBaseImpl implements ExtensionApi.ExtensionViewerBase {

  private __ExtensionViewerBaseImpl_metadata: ExtensionApi.ViewerMetadata = null;

  constructor(private _viewerProxy: ExtensionViewerProxy, ..._: any[]) {
    this.__ExtensionViewerBaseImpl_metadata = {
      title: "ExtensionViewer",
      deleteable: true,
      moveable: true,
      icon: null,
      posture: ExtensionApi.ViewerPosture.NEUTRAL,
      toolTip: null
    };
  }

  created(): void {
  }

  getContainerElement(): HTMLElement {
    return this._viewerProxy.getContainerNode();
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this.__ExtensionViewerBaseImpl_metadata;
  }
  
  updateMetadata(changes: ExtensionApi.ViewerMetadataChange): void {
    let changed = false;
    for (const key of Object.getOwnPropertyNames(changes)) {
      if (this.__ExtensionViewerBaseImpl_metadata[key] !== changes[key]) {
        this.__ExtensionViewerBaseImpl_metadata[key] = changes[key];
        changed = true;
      }
    }

    if (changed) {
      this._viewerProxy._metadataUpdated();
    }
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return null;
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): void {
  }
}

class ExtensionSessionEditorProxy extends ThemeableElementBase  {

}

class ExtensionSessionEditorBaseImpl implements ExtensionApi.ExtensionSessionEditorBase {
  created(): void {
  }

  getContainerElement(): HTMLElement {
    return null;  // FIXME implement
  }
}

export class TerminalTabProxy implements ExtensionApi.Tab {

  constructor(private _internalExtensionContext: ProxyFactory, private _extensionUiUtils: ExtensionUiUtils,
    private _terminal: EtTerminal) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showListPicker(this._terminal, options);
  }
}


export class TerminalProxy implements ExtensionApi.Terminal {
  
  viewerType: 'terminal-output';

  constructor(private _proxyFactory: ProxyFactory, private _terminal: EtTerminal) {
  }

  getTab(): ExtensionApi.Tab {
    return this._proxyFactory.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  getViewers(): ExtensionApi.Viewer[] {
    return this._terminal.getViewerElements().map(viewer => this._proxyFactory.getViewerProxy(viewer));
  }

  getExtratermCookieValue(): string {
    return this._terminal.getExtratermCookieValue();
  }

  getExtratermCookieName(): string{
    return EXTRATERM_COOKIE_ENV;
  }
}
