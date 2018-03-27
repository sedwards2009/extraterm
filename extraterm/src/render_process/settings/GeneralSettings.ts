/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { GeneralSettingsUi } from './GeneralSettingsUi';
import { Config } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';

export const GENERAL_SETTINGS_TAG = "et-general-settings";

@WebComponent({tag: GENERAL_SETTINGS_TAG})
export class GeneralSettings extends SettingsBase<GeneralSettingsUi> {
  private _log: Logger = null;

  constructor() {
    super(GeneralSettingsUi);
    this._log = getLogger(GENERAL_SETTINGS_TAG, this);
  }

  protected _setConfig(config: Config): void {
    const ui = this._getUi();

    if (ui.showTips !== config.showTips) {
      ui.showTips = config.showTips;
    }
    
    // We take care to only update things which have actually changed.
    if (ui.maxScrollbackLines !== config.scrollbackMaxLines) {
      ui.maxScrollbackLines = config.scrollbackMaxLines;
    }

    if (ui.maxScrollbackFrames !== config.scrollbackMaxFrames) {
      ui.maxScrollbackFrames = config.scrollbackMaxFrames;
    }
  }

  protected _dataChanged(): void {
    const newConfig = this._getConfigCopy();
    const ui = this._getUi();

    newConfig.showTips = ui.showTips;
    newConfig.scrollbackMaxLines = ui.maxScrollbackLines;
    newConfig.scrollbackMaxFrames = ui.maxScrollbackFrames;

    this._updateConfig(newConfig);
  }
}
