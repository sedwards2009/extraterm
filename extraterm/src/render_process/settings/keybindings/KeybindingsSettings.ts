/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { WebComponent } from 'extraterm-web-component-decorators';

import { KeybindingsSettingsUi, EVENT_DUPLICATE, EVENT_DELETE, EVENT_RENAME } from './KeybindingsSettingsUi';
import { SYSTEM_CONFIG, SystemConfig, ConfigKey, GENERAL_CONFIG, GeneralConfig } from '../../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from '../SettingsBase';
import * as WebIpc from '../../WebIpc';
import * as ThemeTypes from '../../../theme/Theme';
import { KeybindingsManager } from '../../keybindings/KeyBindingsManager';
import { EVENT_START_KEY_INPUT, EVENT_END_KEY_INPUT } from './ContextUi';

export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeybindingsSettings extends SettingsBase<KeybindingsSettingsUi> {
  private _log: Logger = null;
  private _autoSelect: string = null;
  private _keybindingsManager: KeybindingsManager = null;

  constructor() {
    super(KeybindingsSettingsUi, [SYSTEM_CONFIG, GENERAL_CONFIG]);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);

    this._getUi().$on(EVENT_DUPLICATE, keybindingsName => {
      const destName = keybindingsName + " copy";
      this._autoSelect = destName;
      WebIpc.keybindingsCopy(keybindingsName, destName);
    });

    this._getUi().$on(EVENT_DELETE, keybindingsFilename => {
      WebIpc.keybindingsDelete(keybindingsFilename);
    });
    
    this._getUi().$on(EVENT_RENAME, (keybindingsName, newKeybindingsName) => {
      this._autoSelect = newKeybindingsName;
      WebIpc.keybindingsRename(keybindingsName, newKeybindingsName);
    });

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

    if (key === SYSTEM_CONFIG) {
      const systemConfig = <SystemConfig> config;
      if (ui.keybindingsInfoList.length !== systemConfig.keybindingsInfoList.length) {
        ui.keybindingsInfoList = systemConfig.keybindingsInfoList;
        if (this._autoSelect != null) {
          ui.selectedKeybindings = this._autoSelect;
          this._loadKeybindings(ui.selectedKeybindings);
          this._autoSelect = null;
        }
      }
    }

    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;
      if (ui.selectedKeybindings !== generalConfig.keybindingsName) {
        ui.selectedKeybindings = generalConfig.keybindingsName;
        this._loadKeybindings(ui.selectedKeybindings);
      }
    }
  }

  private _loadKeybindings(name: string): void {
    WebIpc.keybindingsRequestRead(name).then(msg => {
      this._getUi().keybindings = msg.keybindings;
    });
  }

  protected _dataChanged(): void {
    const newGeneralConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    if (newGeneralConfig.keybindingsName !== ui.selectedKeybindings) {
      newGeneralConfig.keybindingsName = ui.selectedKeybindings;
      this._updateConfig(GENERAL_CONFIG, newGeneralConfig);
      this._loadKeybindings(ui.selectedKeybindings);
    }
  }

  set keybindingsManager(keybindingsManager: KeybindingsManager) {
    this._keybindingsManager = keybindingsManager;
  }

  get keybindingsManager(): KeybindingsManager {
    return this._keybindingsManager;
  }  
}
