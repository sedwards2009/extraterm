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


export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeybindingsSettings extends SettingsBase<KeybindingsSettingsUi> {
  private _log: Logger = null;
  private _keyBindingOnChangeEmitterElementLifecycleBinder: OnChangeEmitterElementLifecycleBinder<KeybindingsManager> = null;

  constructor() {
    super(KeybindingsSettingsUi, [SYSTEM_CONFIG, GENERAL_CONFIG]);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);
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

  protected _setConfig(key: ConfigKey, config: any): void {
    const ui = this._getUi();

    if (key === SYSTEM_CONFIG) {
      const systemConfig = <SystemConfig> config;
      if (ui.keybindingsFiles.length !== systemConfig.keyBindingsFiles.length) {
        ui.keybindingsFiles = systemConfig.keyBindingsFiles;
      }
    }

    if (key === GENERAL_CONFIG) {
      const generalConfig = <GeneralConfig> config;
      if (ui.selectedKeybindings !== config.keyBindingsFilename) {
        ui.selectedKeybindings = config.keyBindingsFilename;
      }
    }
  }

  protected _dataChanged(): void {
    const newGeneralConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    if (newGeneralConfig.keyBindingsFilename !== ui.selectedKeybindings) {
      newGeneralConfig.keyBindingsFilename = ui.selectedKeybindings;
      this._updateConfig(GENERAL_CONFIG, newGeneralConfig);
    }
  }

  set keyBindingsManager(keyBindingsManager: KeybindingsManager) {
    this._keyBindingOnChangeEmitterElementLifecycleBinder.setOnChangeEmitter(keyBindingsManager);
    if (keyBindingsManager == null) {
      return;
    }
    this._getUi().setKeybindingsContexts(keyBindingsManager.getKeybindingsContexts());
  }

  get keyBindingsManager(): KeybindingsManager {
    return this._keyBindingOnChangeEmitterElementLifecycleBinder.getOnChangeEmitter();
  }
}
