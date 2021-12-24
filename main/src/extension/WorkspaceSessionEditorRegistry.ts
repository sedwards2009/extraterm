/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import * as _ from 'lodash';

import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { ExtensionSessionEditorContribution } from './ExtensionMetadata';
import { InternalExtensionContext, InternalSessionEditor, SessionConfigurationChange } from '../InternalTypes';
import { NodeWidget } from '@nodegui/nodegui';


export class WorkspaceSessionEditorRegistry {
  private _log: Logger = null;
  private _registeredSessionEditors: Map<string, ExtensionApi.SessionEditorFactory> = null;

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionEditorRegistry", this);
    this._registeredSessionEditors = new Map();
  }

  registerSessionEditor(type: string, factory: ExtensionApi.SessionEditorFactory): void {
    let sessionEditorMetadata: ExtensionSessionEditorContribution = null;
    for (const semd of this._internalExtensionContext._extensionMetadata.contributes.sessionEditors) {
      if (semd.type === type) {
        sessionEditorMetadata = semd;
        break;
      }
    }

    if (sessionEditorMetadata == null) {
      this._log.warn(`Unable to register session editor '${type}' for extension ` +
        `'${this._internalExtensionContext._extensionMetadata.name}' because the session editor contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this._registeredSessionEditors.set(sessionEditorMetadata.type, factory);
  }

  private _getExtensionSessionEditorContributionByType(type: string): ExtensionSessionEditorContribution {
    for (const se of this._internalExtensionContext._extensionMetadata.contributes.sessionEditors) {
      if (se.type === type) {
        return se;
      }
    }
    return null;
  }

  createSessionEditor(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionEditor {
    const factory = this._registeredSessionEditors.get(sessionType);
    const sessionEditorMetadata = this._getExtensionSessionEditorContributionByType(sessionType);
    if (sessionEditorMetadata == null) {
      return null;
    }

    const editorBase = new SessionEditorBaseImpl(sessionConfiguration, factory);
    return editorBase;
  }
}

export class SessionEditorBaseImpl implements InternalSessionEditor {
  #sessionConfiguration: ExtensionApi.SessionConfiguration = null;
  onSessionConfigurationChanged: ExtensionApi.Event<SessionConfigurationChange>;
  #onSettingsConfigurationChangedEventEmitter = new EventEmitter<SessionConfigurationChange>();
  #widget: NodeWidget<any> = null;

  constructor(sessionConfiguration: ExtensionApi.SessionConfiguration,
      private _factory: ExtensionApi.SessionEditorFactory) {
    this.#sessionConfiguration = _.cloneDeep(sessionConfiguration);
    this.onSessionConfigurationChanged = this.#onSettingsConfigurationChangedEventEmitter.event;
    this.#widget = this._factory.call(null, this);
  }

  _getWidget(): NodeWidget<any> {
    return this.#widget;
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this.#sessionConfiguration;
  }

  setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
    this.#sessionConfiguration = sessionConfiguration;
    this.#onSettingsConfigurationChangedEventEmitter.fire({
      sessionConfiguration: _.cloneDeep(sessionConfiguration)
    });
  }
}
