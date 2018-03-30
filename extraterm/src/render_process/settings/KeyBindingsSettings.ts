/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { KeyBindingsSettingsUi} from './KeyBindingsSettingsUi';
import { Config } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';
import { KeyBindingManager } from '../keybindings/KeyBindingManager';

export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeyBindingsSettings extends SettingsBase<KeyBindingsSettingsUi> {
  private _log: Logger = null;
  private _keyBindingManager: KeyBindingManager = null;

  constructor() {
    super(KeyBindingsSettingsUi);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);
  }

  protected _setConfig(config: Config): void {
    const ui = this._getUi();

    if (ui.keyBindingsFiles.length !== config.systemConfig.keyBindingsFiles.length) {
      ui.keyBindingsFiles = config.systemConfig.keyBindingsFiles;
    }
    if (ui.selectedKeyBindings !== config.keyBindingsFilename) {
      ui.selectedKeyBindings = config.keyBindingsFilename;
    }
  }

  protected _dataChanged(): void {
    const newConfig = this._getConfigCopy();
    const ui = this._getUi();

    if (newConfig.keyBindingsFilename !== ui.selectedKeyBindings) {
      newConfig.keyBindingsFilename = ui.selectedKeyBindings;
      this._updateConfig(newConfig);
    }
  }

  set keyBindingManager(keyBindingManager: KeyBindingManager) {
    this._keyBindingManager = keyBindingManager;
    this._getUi().setKeyBindingsContexts(keyBindingManager.getKeyBindingsContexts());

    
  }

  get keyBindingManager(): KeyBindingManager {
    return this._keyBindingManager;
  }
}
