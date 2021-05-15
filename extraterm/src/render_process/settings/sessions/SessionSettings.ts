/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { CustomElement } from 'extraterm-web-component-decorators';
import { DebouncedDoLater } from 'extraterm-later';
import * as _ from 'lodash';

import { SessionSettingsUi } from './SessionSettingsUi';
import { SESSION_CONFIG, ConfigKey } from '../../../Config';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from '../SettingsBase';
import { ExtensionManager } from '../../extension/InternalTypes';
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';

export const SESSION_SETTINGS_TAG = "et-session-settings";

@CustomElement(SESSION_SETTINGS_TAG)
export class SessionSettings extends SettingsBase<SessionSettingsUi> {
  private _log: Logger = null;
  private _extensionManager: ExtensionManager = null;
  private _updateLater: DebouncedDoLater = null;

  constructor() {
    super(SessionSettingsUi);
    this._log = getLogger(SESSION_SETTINGS_TAG, this);

    this._updateLater = new DebouncedDoLater(() => {
      this.configDatabase.setSessionConfig(this._getUi().sessions);
    }, 500);
  }

  protected _setConfigInUi(key: ConfigKey, config: any): void {
    if (key === SESSION_CONFIG) {
      const ui = this._getUi();
      const sessions = <SessionConfiguration[]> config;
      if ( ! _.isEqual(ui.sessions, sessions)) {
        const sessionsCopy = _.cloneDeep(sessions);
        for (const session of sessionsCopy) {
          if (session.extensions == null) {
            session.extensions = {};
          }
        }
        ui.sessions = sessionsCopy;
      }
    }
  }

  protected _dataChanged(): void {
    this._updateLater.trigger();
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
    this._getUi().setExtensionManager(extensionManager);
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }
}
