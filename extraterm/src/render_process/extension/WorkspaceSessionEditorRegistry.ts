/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import { ExtensionSessionEditorContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';
import { Logger, getLogger } from '../../logging/Logger';
import { ThemeableElementBase } from '../ThemeableElementBase';

interface RegisteredSessionEditor {
  type: string;
  tag: string;
}

export class WorkspaceSessionEditorRegistry {
  private _log: Logger = null;
  private _registeredSessionEditors: RegisteredSessionEditor[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionEditorRegistry", this);
  }

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


class ExtensionSessionEditorProxy extends ThemeableElementBase  {

}

export class ExtensionSessionEditorBaseImpl implements ExtensionApi.ExtensionSessionEditorBase {
  created(): void {
  }

  getContainerElement(): HTMLElement {
    return null;  // FIXME implement
  }
}
