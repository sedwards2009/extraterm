/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';

import { ExtensionSessionEditorContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { ThemeableElementBase } from '../ThemeableElementBase';
import { CssFile } from '../../theme/Theme';
import { log } from "extraterm-logging";


export class WorkspaceSessionEditorRegistry {
  private _log: Logger = null;
  private _registeredSessionEditors: Map<string, string> = null;

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionEditorRegistry", this);
    this._registeredSessionEditors = new Map();
  }

  registerSessionEditor(type: string, sessionEditorClass: ExtensionApi.ExtensionSessionEditorBaseConstructor): void {
    let sessionEditorMetadata: ExtensionSessionEditorContribution = null;
    for (const semd of this._internalExtensionContext.extensionMetadata.contributes.sessionEditors) {
      if (semd.type === type) {
        sessionEditorMetadata = semd;
        break;
      }
    }

    if (sessionEditorMetadata == null) {
      this._log.warn(`Unable to register session editor '${type}' for extension ` +
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
    
      protected _getExtensionSessionEditorContribution(): ExtensionSessionEditorContribution {
        return sessionEditorMetadata;
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-session-editor-" + kebabCase(type);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, sessionEditorProxyClass);

    this._registeredSessionEditors.set(sessionEditorMetadata.type, tag);
  }

  getSessionEditorTagForType(sessionType: string): string {
    const tag = this._registeredSessionEditors.get(sessionType);
    return tag == null ? null : tag;
  }
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionSessionEditorProxy extends ThemeableElementBase  {
  private _extensionSessionEditor: ExtensionSessionEditorBaseImpl = null;
  private _log: Logger = null;
  private _doneSetup = false;

  constructor() {
    super();
    this._log = getLogger("ExtensionSessionEditorProxy", this);
    this._extensionSessionEditor = <ExtensionSessionEditorBaseImpl> this._createExtensionSessionEditor();
  }

  private _styleElement: HTMLStyleElement = null;
  private _containerDivElement: HTMLDivElement = null;

  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._doneSetup) {
      this._doneSetup = true;
      this._setupDOM();
      this._extensionSessionEditor.created();
    }
  }

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    this._styleElement = document.createElement("style");
    this._styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(this._styleElement);

    this._containerDivElement = document.createElement("div");
    this.shadowRoot.appendChild(this._containerDivElement);

    this.updateThemeCss();
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerNode(): HTMLDivElement {
    return this._containerDivElement;
  }

  protected _createExtensionSessionEditor(): ExtensionApi.ExtensionSessionEditorBase {
    return null;
  }

  protected _getExtensionContext(): InternalExtensionContext {
    return null;
  }

  protected _getExtensionSessionEditorContribution(): ExtensionSessionEditorContribution {
    return null;
  }

  protected _themeCssFiles(): CssFile[] {
    const extensionContext = this._getExtensionContext();
    const name = extensionContext.extensionMetadata.name;
    const cssDecl = this._getExtensionSessionEditorContribution().css;
    const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + cf);

    const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
    return [CssFile.GENERAL_GUI, ...fontAwesomeCss, ...cssFiles];
  }

  _sessionConfigurationChanged(): void {
    const config = this._extensionSessionEditor.getSessionConfiguration();
    
    const changeEvent = new CustomEvent("change", {bubbles: true, composed: true});
    changeEvent.initCustomEvent("change", true, true, null);
    this.dispatchEvent(changeEvent);
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this._extensionSessionEditor.getSessionConfiguration();
  }

  set sessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration) {
    if ( ! this._doneSetup) {
      this._extensionSessionEditor.__setSessionConfiguration(sessionConfiguration);
    } else {
      this._extensionSessionEditor.setSessionConfiguration(sessionConfiguration);
    }
  }
}


export class ExtensionSessionEditorBaseImpl implements ExtensionApi.ExtensionSessionEditorBase {
  private __ExtensionSessionEditorBaseImpl_sessionConfiguration: ExtensionApi.SessionConfiguration = null;

  constructor(private _sessionEditorProxy: ExtensionSessionEditorProxy, ..._: any[]) {
  }

  created(): void {
  }

  getContainerElement(): HTMLElement {
    return this._sessionEditorProxy.getContainerNode();
  }

  setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
    this.__setSessionConfiguration(sessionConfiguration);
  }

  __setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
    this.__ExtensionSessionEditorBaseImpl_sessionConfiguration = sessionConfiguration;
  }

  getSessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this.__ExtensionSessionEditorBaseImpl_sessionConfiguration;
  }

  updateSessionConfiguration(changes: object): void {
    let changed = false;
    for (const key of Object.getOwnPropertyNames(changes)) {
      if (this.__ExtensionSessionEditorBaseImpl_sessionConfiguration[key] !== changes[key]) {
        this.__ExtensionSessionEditorBaseImpl_sessionConfiguration[key] = changes[key];
        changed = true;
      }
    }

    if (changed) {
      this._sessionEditorProxy._sessionConfigurationChanged();
    }
  }
}
