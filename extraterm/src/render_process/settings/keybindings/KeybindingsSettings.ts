/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { WebComponent } from 'extraterm-web-component-decorators';

import { KeybindingsSettingsUi } from './KeybindingsSettingsUi';
import { SYSTEM_CONFIG, SystemConfig, ConfigKey, GENERAL_CONFIG, GeneralConfig } from '../../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from '../SettingsBase';
import * as WebIpc from '../../WebIpc';
import * as ThemeTypes from '../../../theme/Theme';
import { KeybindingsManager } from '../../keybindings/KeyBindingsManager';
import { EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './KeybindingsCategoryUi';
import { ExtensionManager } from '../../extension/InternalTypes';
import { ExtensionCommandContribution } from '../../../ExtensionMetadata';
import { Disposable } from '@extraterm/extraterm-extension-api';
import { LogicalKeybindingsName } from 'extraterm/src/keybindings/KeybindingsTypes';

export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeybindingsSettings extends SettingsBase<KeybindingsSettingsUi> {
  private _log: Logger = null;
  private _keybindingsManager: KeybindingsManager = null;
  private _extensionManager: ExtensionManager = null;
  private _commandChangedDisposable: Disposable = null;

  constructor() {
    super(KeybindingsSettingsUi, [SYSTEM_CONFIG, GENERAL_CONFIG]);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);

    this._getUi().$on(EVENT_START_KEY_INPUT, () => {
      if (this._keybindingsManager != null) {
        this._keybindingsManager.setEnabled(false);
      }
    });

    this._getUi().$on(EVENT_END_KEY_INPUT, () => {
      if (this._keybindingsManager != null) {
        this._keybindingsManager.setEnabled(true);
      }
    });
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.KEY_BINDINGS_TAB, ...super._themeCssFiles()];
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    const ui = this._getUi();

    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;
      if (ui.selectedKeybindingsSetName !== generalConfig.keybindingsName || this._getUi().baseKeybindingsSet == null) {
        ui.selectedKeybindingsSetName = generalConfig.keybindingsName;
        this._loadKeybindings(ui.selectedKeybindingsSetName);
      }
    }
  }

  private async _loadKeybindings(name: LogicalKeybindingsName): Promise<void> {
    const msg = await WebIpc.keybindingsRequestRead(name);
    this._getUi().baseKeybindingsSet = msg.stackedKeybindingsFile.keybindingsSet;
    
  }

  protected _dataChanged(): void {
    const newGeneralConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    if (newGeneralConfig.keybindingsName !== ui.selectedKeybindingsSetName) {
      newGeneralConfig.keybindingsName = ui.selectedKeybindingsSetName;
      this._updateConfig(GENERAL_CONFIG, newGeneralConfig);
      this._loadKeybindings(ui.selectedKeybindingsSetName);
    }
// FIXME
    // WebIpc.keybindingsUpdate(ui.selectedKeybindings, ui.keybindings);
  }

  set keybindingsManager(keybindingsManager: KeybindingsManager) {
    this._keybindingsManager = keybindingsManager;
  }

  get keybindingsManager(): KeybindingsManager {
    return this._keybindingsManager;
  }

  set extensionManager(extensionManager: ExtensionManager) {
    this._extensionManager = extensionManager;

    if (this._commandChangedDisposable != null) {
      this._commandChangedDisposable.dispose();
      this._commandChangedDisposable = null;
    }

    this._commandChangedDisposable = this._extensionManager.onCommandsChanged(() => {
      this._getUi().commandsByCategory = this._buildCommandsByCategory(this._extensionManager);
    });
    this._getUi().commandsByCategory = this._buildCommandsByCategory(this._extensionManager);
  }

  private _buildCommandsByCategory(extensionManager: ExtensionManager):
      { [index: string]: ExtensionCommandContribution[] } {

    const allCommands = extensionManager.queryCommands({ });
    const commandsByCategory: { [index: string]: ExtensionCommandContribution[] } = {};
    for (const contrib of allCommands) {
      if (commandsByCategory[contrib.category] == null) {
        commandsByCategory[contrib.category] = [];
      }
      commandsByCategory[contrib.category].push(contrib);
    }
    return commandsByCategory;
  }

  get extensionManager(): ExtensionManager {
    return this._extensionManager;
  }
}
