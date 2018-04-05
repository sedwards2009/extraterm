/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { SessionSettingsUi } from './SessionSettingsUi';
import { Config, FontInfo } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';
import { ExtensionManager } from '../extension/InternalTypes';

export const SESSION_SETTINGS_TAG = "et-session-settings";

@WebComponent({tag: SESSION_SETTINGS_TAG})
export class SessionSettings extends SettingsBase<SessionSettingsUi> {
  private _log: Logger = null;
  private _extensionManager: ExtensionManager = null;

  constructor() {
    super(SessionSettingsUi);
    this._log = getLogger(SESSION_SETTINGS_TAG, this);
  }

  protected _setConfig(config: Config): void {
    const ui = this._getUi();

    // ui.sessions = config.sessions;
    const sessions = [
      {
        uuid: "1234",
        name: "fish",
        type: "unix",
        shell: "/usr/bin/fish"
      }
    ];
    ui.sessions = sessions;
  }

  protected _dataChanged(): void {
    // const newConfig = this._getConfigCopy();
    // const ui = this._getUi();
    
    // this._updateConfig(newConfig);
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
    this._getUi().setExtensionManager(extensionManager);
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }
}
