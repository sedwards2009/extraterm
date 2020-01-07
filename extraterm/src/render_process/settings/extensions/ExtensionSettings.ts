/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { Logger, getLogger } from "extraterm-logging";
import { WebComponent } from 'extraterm-web-component-decorators';
import { SettingsBase } from '../SettingsBase';

import { GeneralConfig, SystemConfig, ConfigKey, GENERAL_CONFIG, SYSTEM_CONFIG } from '../../../Config';

import { ExtensionSettingsUi } from './ExtensionSettingsUi';
import { ExtensionManager } from "../../extension/InternalTypes";

export const EXTENSION_SETTINGS_TAG = "et-extension-settings";

@WebComponent({tag: EXTENSION_SETTINGS_TAG})
export class ExtensionSettings extends SettingsBase<ExtensionSettingsUi> {
  private _log: Logger = null;

  private _extensionManager: ExtensionManager = null;

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

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
    
    this._getUi().allExtensions = this._extensionManager.getAllExtensions();

    // if (this._commandChangedDisposable != null) {
    //   this._commandChangedDisposable.dispose()
    //   this._commandChangedDisposable = null;
    // }
  }
}
