/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import * as _ from 'lodash';

import { ExtensionContainerElement } from './ExtensionContainerElement';
import { ExtensionSessionEditorContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext, InternalSessionEditor, SessionConfigurationChange } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";


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
    const extensionContainerElement = <ExtensionContainerElement> document.createElement(
      ExtensionContainerElement.TAG_NAME);

    extensionContainerElement._setExtensionContext(this._internalExtensionContext);
    extensionContainerElement._setExtensionCss(sessionEditorMetadata.css);

    const editorBase = new SessionEditorBaseImpl(extensionContainerElement, sessionConfiguration, factory);
    return editorBase;
  }
}

export class SessionEditorBaseImpl implements InternalSessionEditor {
  private _sessionConfiguration: ExtensionApi.SessionConfiguration = null;
  onSessionConfigurationChanged: ExtensionApi.Event<SessionConfigurationChange>;
  private _onSettingsConfigurationChangedEventEmitter = new EventEmitter<SessionConfigurationChange>();

  constructor(private _extensionContainerElement: ExtensionContainerElement,
      sessionConfiguration: ExtensionApi.SessionConfiguration,
      private _factory: ExtensionApi.SessionEditorFactory) {
    this._sessionConfiguration = _.cloneDeep(sessionConfiguration);
    this.onSessionConfigurationChanged = this._onSettingsConfigurationChangedEventEmitter.event;
  }

  _init(): void {
    this._factory.call(null, this);
  }

  get containerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
  }

  _getExtensionContainerElement(): ExtensionContainerElement {
    return this._extensionContainerElement;
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this._sessionConfiguration;
  }

  setSessionConfiguration(sessionConfiguration: ExtensionApi.SessionConfiguration): void {
    this._sessionConfiguration = sessionConfiguration;
    this._onSettingsConfigurationChangedEventEmitter.fire({
      sessionConfiguration: _.cloneDeep(sessionConfiguration)
    });
  }
}
