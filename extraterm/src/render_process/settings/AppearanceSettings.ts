/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { AppearanceSettingsUi } from './AppearanceSettingsUi';
import { Config } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';

export const APPEARANCE_SETTINGS_TAG = "et-appearance-settings";

@WebComponent({tag: APPEARANCE_SETTINGS_TAG})
export class AppearanceSettings extends SettingsBase {
  private _log: Logger;
  private _ui: AppearanceSettingsUi = null;

  constructor() {
    super();
    this._log = getLogger(APPEARANCE_SETTINGS_TAG, this);
  }

  // protected _themeCssFiles(): ThemeTypes.CssFile[] {
  //   return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  // }

  protected _createVueUi(): Vue {
    this._ui = new AppearanceSettingsUi();
    return this._ui;
  }

  protected _setConfig(config: Config): void {

  }

  protected _dataChanged(): void {

  }
}
