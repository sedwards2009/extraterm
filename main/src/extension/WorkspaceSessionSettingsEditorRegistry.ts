/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import * as _ from 'lodash';

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionSessionEditorContribution, ExtensionSessionSettingsContribution } from './ExtensionMetadata';
import { InternalSessionEditor, InternalSessionSettingsEditor, SessionConfigurationChange, SessionSettingsChange } from '../InternalTypes';
import { NodeWidget } from '@nodegui/nodegui';


export class WorkspaceSessionSettingsEditorRegistry {
  private _log: Logger = null;
  #registeredSessionSettingsEditors: Map<string, ExtensionApi.SessionSettingsEditorFactory> = null;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("WorkspaceSessionSettingsEditorRegistry", this);
    this.#extensionMetadata = extensionMetadata;
    this.#registeredSessionSettingsEditors = new Map();
  }

  registerSessionSettingsEditor(id: string, factory: ExtensionApi.SessionSettingsEditorFactory): void {
    let sessionSettingsEditorMetadata: ExtensionSessionSettingsContribution = null;
    for (const semd of this.#extensionMetadata.contributes.sessionSettings) {
      if (semd.id === id) {
        sessionSettingsEditorMetadata = semd;
        break;
      }
    }

    if (sessionSettingsEditorMetadata == null) {
      this._log.warn(`Unable to register session settings editor '${id}' for extension ` +
        `'${this.#extensionMetadata.name}' because the session editor contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    this.#registeredSessionSettingsEditors.set(sessionSettingsEditorMetadata.id, factory);
  }

  #getExtensionSessionSettingsContributionById(id: string): ExtensionSessionSettingsContribution {
    for (const ssm of this.#extensionMetadata.contributes.sessionSettings) {
      if (ssm.id === id) {
        return ssm;
      }
    }
    return null;
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionSettingsEditor[] {

    const result: InternalSessionSettingsEditor[] = [];
    for (const id of this.#registeredSessionSettingsEditors.keys()) {
      const factory = this.#registeredSessionSettingsEditors.get(id);
      const sessionSettingsMetadata = this.#getExtensionSessionSettingsContributionById(id);

      const settingsConfigKey = `${this.#extensionMetadata.name}:${id}`;

      let settings = sessionConfiguration.extensions?.[settingsConfigKey];
      if (settings == null) {
        settings = {};
      }

      const editorBase = new SessionSettingsEditorBaseImpl(sessionSettingsMetadata.name, settingsConfigKey, settings,
        factory);
      result.push(editorBase);
    }
    return result;
  }
}

export class SessionSettingsEditorBaseImpl implements InternalSessionSettingsEditor {
  #name: string;
  #key: string;
  #settings: object;

  onSettingsChanged: ExtensionApi.Event<SessionSettingsChange>;
  #onSettingsChangedEventEmitter = new EventEmitter<SessionSettingsChange>();

  #widget: NodeWidget<any> = null;

  constructor(name: string, key: string, settings: Object, factory: ExtensionApi.SessionSettingsEditorFactory) {
    this.#name = name;
    this.#key = key;
    this.#settings = settings;
    this.onSettingsChanged = this.#onSettingsChangedEventEmitter.event;
    this.#widget = factory.call(null, this);
  }

  get name(): string {
    return this.#name;
  }

  _getWidget(): NodeWidget<any> {
    return this.#widget;
  }

  get settings(): Object {
    return this.#settings;
  }

  setSettings(settings: Object): void {
    this.#settings = settings;
    this.#onSettingsChangedEventEmitter.fire({
      settingsConfigKey: this.#key,
      settings: _.cloneDeep(settings)
    });
  }
}
