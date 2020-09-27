/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';

import { EventEmitter } from 'extraterm-event-emitter';
import { ExtensionContainerElement } from './ExtensionContainerElement';
import { ExtensionSessionSettingsContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext, InternalSessionSettingsEditor, SessionSettingsChange } from './InternalTypes';
import { log } from "extraterm-logging";
import { Logger, getLogger } from "extraterm-logging";
import {
  SessionSettingsEditorFactory,
  SessionConfiguration
} from '@extraterm/extraterm-extension-api';


export class WorkspaceSessionSettingsRegistry {
  private _log: Logger = null;
  private _registeredSessionSettings = new Map<string, SessionSettingsEditorFactory>();

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceSessionSettingsRegistry", this);
  }

  registerSessionSettingsEditor(name: string, factory: SessionSettingsEditorFactory): void {
    const sessionSettingsMetadata = this._getExtensionSessionSettingsContributionByName(name);
    if (sessionSettingsMetadata == null) {
      this._log.warn(`Unable to register session settings '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the session settings contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this._registeredSessionSettings.set(sessionSettingsMetadata.name, factory);
  }

  private _getExtensionSessionSettingsContributionByName(name: string): ExtensionSessionSettingsContribution {
    for (const ssm of this._internalExtensionContext.extensionMetadata.contributes.sessionSettings) {
      if (ssm.name === name) {
        return ssm;
      }
    }
    return null;
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[] {

    const result: InternalSessionSettingsEditor[] = [];
    for (const name of this._registeredSessionSettings.keys()) {
      const factory = this._registeredSessionSettings.get(name);
      const sessionSettingsMetadata = this._getExtensionSessionSettingsContributionByName(name);
      const extensionContainerElement = <ExtensionContainerElement> document.createElement(ExtensionContainerElement.TAG_NAME);

      extensionContainerElement._setExtensionContext(this._internalExtensionContext);
      extensionContainerElement._setExtensionCss(sessionSettingsMetadata.css);

      const settingsConfigKey = `${this._internalExtensionContext.extensionMetadata.name}:${name}`;

      let settings = sessionConfiguration.extensions?.[settingsConfigKey];
      if (settings == null) {
        settings = {};
      }

      const editorBase = new SessionSettingsEditorBaseImpl(extensionContainerElement, settingsConfigKey,
        settings);

      factory.call(null, editorBase);

      result.push(editorBase);
    }
    return result;
  }
}

class SessionSettingsEditorBaseImpl implements InternalSessionSettingsEditor {
  title: string;
  private _settings: Object = null;
  onSettingsChanged: ExtensionApi.Event<SessionSettingsChange>;
  private _onSettingsChangedEventEmitter = new EventEmitter<SessionSettingsChange>();

  constructor(private _extensionContainerElement: ExtensionContainerElement, private _settingsConfigKey: string,
      settings: Object) {

    this.title = this._settingsConfigKey;
    this._settings = settings;
    this.onSettingsChanged = this._onSettingsChangedEventEmitter.event;
  }

  getContainerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
  }

  _getExtensionContainerElement(): ExtensionContainerElement {
    return this._extensionContainerElement;
  }

  getSettings(): Object {
    return this._settings;
  }

  setSettings(settings: Object): void {
    this._onSettingsChangedEventEmitter.fire({
      settingsConfigKey: this._settingsConfigKey,
      settings
    });
  }
}
