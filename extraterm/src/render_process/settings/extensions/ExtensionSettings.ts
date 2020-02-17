/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { Logger, getLogger } from "extraterm-logging";
import { WebComponent } from 'extraterm-web-component-decorators';
import { SettingsBase } from '../SettingsBase';
import { ConfigKey } from '../../../Config';

import { ExtensionSettingsUi, ExtensionMetadataAndState, EVENT_ENABLE_EXTENSION, EVENT_DISABLE_EXTENSION } from './ExtensionSettingsUi';
import { ExtensionManager } from "../../extension/InternalTypes";
import { Disposable } from "extraterm-extension-api";

export const EXTENSION_SETTINGS_TAG = "et-extension-settings";

@WebComponent({tag: EXTENSION_SETTINGS_TAG})
export class ExtensionSettings extends SettingsBase<ExtensionSettingsUi> {
  private _log: Logger = null;

  private _extensionManager: ExtensionManager = null;
  private _stateChangedDisposable: Disposable = null;
  
  constructor() {
    super(ExtensionSettingsUi, []);
    this._log = getLogger(EXTENSION_SETTINGS_TAG, this);

    this._getUi().$on(EVENT_ENABLE_EXTENSION, (extensionName: string): void => {
      this._extensionManager.enableExtension(extensionName);
    });

    this._getUi().$on(EVENT_DISABLE_EXTENSION, (extensionName: string): void => {
      this._extensionManager.disableExtension(extensionName);
    });
  }

  protected _setConfig(key: ConfigKey, config: any): void {
  }

  protected _dataChanged(): void {
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;
    
    if (this._stateChangedDisposable != null) {
      this._stateChangedDisposable.dispose();
      this._stateChangedDisposable = null;
    }
    const updateExtensionInfo = () => {
      this._getUi().allExtensions = this._combineExtensionMetadataAndState(this._extensionManager);
    };
    this._stateChangedDisposable = this._extensionManager.onStateChanged(updateExtensionInfo);
    updateExtensionInfo();
  }

  private _combineExtensionMetadataAndState(extensionManager: ExtensionManager): ExtensionMetadataAndState[] {
    const result: ExtensionMetadataAndState[] = [];

    for (const extension of extensionManager.getAllExtensions()) {
      result.push({ metadata: extension, running: extensionManager.isExtensionRunning(extension.name) });
    }
    return result;
  }
}
