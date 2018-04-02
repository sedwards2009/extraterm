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

export const SESSION_SETTINGS_TAG = "et-session-settings";

@WebComponent({tag: SESSION_SETTINGS_TAG})
export class SessionSettings extends SettingsBase<SessionSettingsUi> {
  private _log: Logger = null;
  private _fontOptions: FontInfo[] = [];

  constructor() {
    super(SessionSettingsUi);
    this._log = getLogger(SESSION_SETTINGS_TAG, this);
  }

  protected _setConfig(config: Config): void {
    const ui = this._getUi();

  }

  protected _dataChanged(): void {
    const newConfig = this._getConfigCopy();
    const ui = this._getUi();
    
    this._updateConfig(newConfig);
  }
}
