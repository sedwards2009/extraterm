/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { WebComponent } from 'extraterm-web-component-decorators';

import { KeybindingsSettingsUi} from './KeyBindingsSettingsUi';
import { SYSTEM_CONFIG, SystemConfig, ConfigKey, GENERAL_CONFIG, GeneralConfig } from '../../Config';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";
import { SettingsBase } from './SettingsBase';
import { KeybindingsManager } from '../keybindings/KeyBindingsManager';
import { OnChangeEmitterElementLifecycleBinder } from './OnChangeEmitterElementLifecycleBinder';
import * as WebIpc from '../WebIpc';
import * as ThemeTypes from '../../theme/Theme';


export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeybindingsSettings extends SettingsBase<KeybindingsSettingsUi> {
  private _log: Logger = null;
  private _keyBindingOnChangeEmitterElementLifecycleBinder: OnChangeEmitterElementLifecycleBinder<KeybindingsManager> = null;
  private _autoSelect: string = null;

  constructor() {
    super(KeybindingsSettingsUi, [SYSTEM_CONFIG, GENERAL_CONFIG]);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);

    this._getUi().$on("duplicate", keybindingsName => {
      const destName = keybindingsName + " copy";
      this._autoSelect = destName;
      WebIpc.keybindingsCopy(keybindingsName, destName);
    });

    this._getUi().$on("delete", keybindingsFilename => {
      // WebIpc.keybindings
    });

    this._keyBindingOnChangeEmitterElementLifecycleBinder =
      new OnChangeEmitterElementLifecycleBinder<KeybindingsManager>(this._handleKeybindingsManagerChange.bind(this));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._keyBindingOnChangeEmitterElementLifecycleBinder.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._keyBindingOnChangeEmitterElementLifecycleBinder.disconnectedCallback();
  }

  private _handleKeybindingsManagerChange(keybindingsManager: KeybindingsManager): void {
    if (keybindingsManager == null) {
      return;
    }
    this._getUi().setKeybindingsContexts(keybindingsManager.getKeybindingsContexts());
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
          this._autoSelect = null;
        }
      }
    }

    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;
      if (ui.selectedKeybindings !== generalConfig.keybindingsName) {
        ui.selectedKeybindings = generalConfig.keybindingsName;
      }
    }
  }

  protected _dataChanged(): void {
    const newGeneralConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    if (newGeneralConfig.keybindingsName !== ui.selectedKeybindings) {
      newGeneralConfig.keybindingsName = ui.selectedKeybindings;
      this._updateConfig(GENERAL_CONFIG, newGeneralConfig);
    }
  }

  set keybindingsManager(keybindingsManager: KeybindingsManager) {
    this._keyBindingOnChangeEmitterElementLifecycleBinder.setOnChangeEmitter(keybindingsManager);
    if (keybindingsManager == null) {
      return;
    }
    this._getUi().setKeybindingsContexts(keybindingsManager.getKeybindingsContexts());
  }

  get keybindingsManager(): KeybindingsManager {
    return this._keyBindingOnChangeEmitterElementLifecycleBinder.getOnChangeEmitter();
  }
}
