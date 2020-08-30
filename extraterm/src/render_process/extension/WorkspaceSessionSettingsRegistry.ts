/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';

import { ExtensionSessionSettingsContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { ThemeableElementBase } from '../ThemeableElementBase';
import { CssFile } from '../../theme/Theme';
import { log } from "extraterm-logging";


export class WorkspaceSessionSettingsRegistry {
  private _log: Logger = null;
  private _registeredSessionSettings: Map<string, string> = null;

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionSettingsRegistry", this);
    this._registeredSessionSettings = new Map<string, string>();
  }

  registerSessionSettings(name: string, sessionSettingsClass: ExtensionApi.ExtensionSessionSettingsBaseConstructor): void {
    let sessionSettingsMetadata: ExtensionSessionSettingsContribution = null;
    for (const ssm of this._internalExtensionContext.extensionMetadata.contributes.sessionSettings) {
      if (ssm.name === name) {
        sessionSettingsMetadata = ssm;
        break;
      }
    }

    if (sessionSettingsMetadata == null) {
      this._log.warn(`Unable to register session settings '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the session settings contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    const internalExtensionContext = this._internalExtensionContext;

    const sessionSettingsProxyClass = class extends ExtensionSessionSettingsProxy {
      protected _createExtensionSessionSettings(): ExtensionApi.ExtensionSessionSettingsBase {
        return new sessionSettingsClass(this);
      }

      protected _getExtensionContext(): InternalExtensionContext {
        return internalExtensionContext;
      }

      protected _getExtensionSessionSettingsContribution(): ExtensionSessionSettingsContribution {
        return sessionSettingsMetadata;
      }
    };

// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-session-settings-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, sessionSettingsProxyClass);

    this._registeredSessionSettings.set(sessionSettingsMetadata.name, tag);
  }

  getSessionSettingsTagsForType(sessionType: string): string[] {
    return Array.from(this._registeredSessionSettings.values());
  }
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionSessionSettingsProxy extends ThemeableElementBase  {
  private _extensionSessionSettings: ExtensionSessionSettingsBaseImpl = null;
  private _log: Logger = null;
  private _doneSetup = false;

  constructor() {
    super();
    this._log = getLogger("ExtensionSessionSettingsProxy", this);
    this._extensionSessionSettings = <ExtensionSessionSettingsBaseImpl> this._createExtensionSessionSettings();
  }

  private _styleElement: HTMLStyleElement = null;
  private _containerDivElement: HTMLDivElement = null;

  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._doneSetup) {
      this._doneSetup = true;
      this._setupDOM();
      this._extensionSessionSettings.created();
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

  protected _createExtensionSessionSettings(): ExtensionApi.ExtensionSessionSettingsBase {
    return null;
  }

  protected _getExtensionContext(): InternalExtensionContext {
    return null;
  }

  protected _getExtensionSessionSettingsContribution(): ExtensionSessionSettingsContribution {
    return null;
  }

  protected _themeCssFiles(): CssFile[] {
    const extensionContext = this._getExtensionContext();
    const name = extensionContext.extensionMetadata.name;
    const cssDecl = this._getExtensionSessionSettingsContribution().css;
    const cssFiles = cssDecl.cssFile.map(cf =>  name + ":" + cf);

    const fontAwesomeCss = cssDecl.fontAwesome ? [CssFile.FONT_AWESOME] : [];
    return [CssFile.GENERAL_GUI, ...fontAwesomeCss, ...cssFiles];
  }

  // _sessionConfigurationChanged(): void {
  //   const config = this._extensionSessionSettings.getSessionConfiguration();

  //   const changeEvent = new CustomEvent("change", {bubbles: true, composed: true});
  //   changeEvent.initCustomEvent("change", true, true, null);
  //   this.dispatchEvent(changeEvent);
  // }

  // get sessionConfiguration(): ExtensionApi.SessionConfiguration {
  //   return this._extensionSessionSettings.getSessionConfiguration();
  // }

  // set sessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration) {
  //   if ( ! this._doneSetup) {
  //     this._extensionSessionSettings.__setSessionConfiguration(sessionConfiguration);
  //   } else {
  //     this._extensionSessionSettings.setSessionConfiguration(sessionConfiguration);
  //   }
  // }
}


export class ExtensionSessionSettingsBaseImpl implements ExtensionApi.ExtensionSessionSettingsBase {
  // private __ExtensionSessionSettingsBaseImpl_sessionConfiguration: ExtensionApi.SessionConfiguration = null;

  constructor(private _sessionSettingsProxy: ExtensionSessionSettingsProxy, ..._: any[]) {
  }

  created(): void {
  }

  getContainerElement(): HTMLElement {
    return this._sessionSettingsProxy.getContainerNode();
  }

  // setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
  //   this.__setSessionConfiguration(sessionConfiguration);
  // }

  // __setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
  //   this.__ExtensionSessionEditorBaseImpl_sessionConfiguration = sessionConfiguration;
  // }

  // getSessionConfiguration(): ExtensionApi.SessionConfiguration {
  //   return this.__ExtensionSessionEditorBaseImpl_sessionConfiguration;
  // }

  // updateSessionConfiguration(changes: object): void {
  //   let changed = false;
  //   for (const key of Object.getOwnPropertyNames(changes)) {
  //     if (this.__ExtensionSessionEditorBaseImpl_sessionConfiguration[key] !== changes[key]) {
  //       this.__ExtensionSessionEditorBaseImpl_sessionConfiguration[key] = changes[key];
  //       changed = true;
  //     }
  //   }

  //   if (changed) {
  //     this._sessionSettingsProxy._sessionConfigurationChanged();
  //   }
  // }
}
