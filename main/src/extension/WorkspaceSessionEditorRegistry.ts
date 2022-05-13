/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import * as _ from 'lodash-es';

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionSessionEditorContribution } from './ExtensionMetadata.js';
import { InternalSessionEditor, SessionConfigurationChange } from '../InternalTypes.js';
import { QWidget } from '@nodegui/nodegui';


export class WorkspaceSessionEditorRegistry {
  private _log: Logger = null;
  #registeredSessionEditors: Map<string, ExtensionApi.SessionEditorFactory> = null;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("WorkspaceSessionEditorRegistry", this);
    this.#extensionMetadata = extensionMetadata;
    this.#registeredSessionEditors = new Map();
  }

  registerSessionEditor(type: string, factory: ExtensionApi.SessionEditorFactory): void {
    let sessionEditorMetadata: ExtensionSessionEditorContribution = null;
    for (const semd of this.#extensionMetadata.contributes.sessionEditors) {
      if (semd.type === type) {
        sessionEditorMetadata = semd;
        break;
      }
    }

    if (sessionEditorMetadata == null) {
      this._log.warn(`Unable to register session editor '${type}' for extension ` +
        `'${this.#extensionMetadata.name}' because the session editor contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this.#registeredSessionEditors.set(sessionEditorMetadata.type, factory);
  }

  #getExtensionSessionEditorContributionByType(type: string): ExtensionSessionEditorContribution {
    for (const se of this.#extensionMetadata.contributes.sessionEditors) {
      if (se.type === type) {
        return se;
      }
    }
    return null;
  }

  createSessionEditor(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionEditor {
    const factory = this.#registeredSessionEditors.get(sessionType);
    const sessionEditorMetadata = this.#getExtensionSessionEditorContributionByType(sessionType);
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
  #widget: QWidget = null;

  constructor(sessionConfiguration: ExtensionApi.SessionConfiguration,
      factory: ExtensionApi.SessionEditorFactory) {
    this.#sessionConfiguration = _.cloneDeep(sessionConfiguration);
    this.onSessionConfigurationChanged = this.#onSettingsConfigurationChangedEventEmitter.event;
    this.#widget = factory.call(null, this);
  }

  _getWidget(): QWidget {
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
