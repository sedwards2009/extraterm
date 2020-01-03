/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { Logger, getLogger } from "extraterm-logging";
import { WebComponent } from 'extraterm-web-component-decorators';
import { SettingsBase } from '../SettingsBase';

import { GeneralConfig, SystemConfig, ConfigKey, GENERAL_CONFIG, SYSTEM_CONFIG } from '../../../Config';

import { ExtensionSettingsUi } from './ExtensionSettingsUi';

export const EXTENSION_SETTINGS_TAG = "et-extension-settings";

@WebComponent({tag: EXTENSION_SETTINGS_TAG})
export class ExtensionSettings extends SettingsBase<ExtensionSettingsUi> {
  private _log: Logger = null;

  constructor() {
    super(ExtensionSettingsUi, [GENERAL_CONFIG, SYSTEM_CONFIG]);
    this._log = getLogger(EXTENSION_SETTINGS_TAG, this);
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    // const ui = this._getUi();
    // if (key === GENERAL_CONFIG) {
  }

  protected _dataChanged(): void {
    // const newGeneralConfig = this._getConfigCopy(GENERAL_CONFIG);
  }
}
