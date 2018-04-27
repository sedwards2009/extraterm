/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { SessionSettingsUi } from './SessionSettingsUi';
import { FontInfo, SESSION_CONFIG, ConfigKey } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';
import { ExtensionManager } from '../extension/InternalTypes';
import { SessionConfiguration } from 'extraterm-extension-api';

export const SESSION_SETTINGS_TAG = "et-session-settings";

@WebComponent({tag: SESSION_SETTINGS_TAG})
export class SessionSettings extends SettingsBase<SessionSettingsUi> {
  private _log: Logger = null;
  private _extensionManager: ExtensionManager = null;

  constructor() {
    super(SessionSettingsUi, [SESSION_CONFIG]);
    this._log = getLogger(SESSION_SETTINGS_TAG, this);
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    if (key === SESSION_CONFIG) {
      const ui = this._getUi();
      const sessions = <SessionConfiguration[]> config;
      if ( ! _.isEqual(ui.sessions, sessions)) {
        ui.sessions = _.cloneDeep(sessions);
      }
    }
  }

  protected _dataChanged(): void {
    this._updateConfig(SESSION_CONFIG, this._getUi().sessions);
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
    this._getUi().setExtensionManager(extensionManager);
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }
}
