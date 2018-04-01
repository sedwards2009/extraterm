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
import { KeyBindingsManager } from '../keybindings/KeyBindingManager';
import { OnChangeEmitterElementLifecycleBinder } from './OnChangeEmitterElementLifecycleBinder';


export const KEY_BINDINGS_SETTINGS_TAG = "et-key-bindings-settings";

@WebComponent({tag: KEY_BINDINGS_SETTINGS_TAG})
export class KeyBindingsSettings extends SettingsBase<KeyBindingsSettingsUi> {
  private _log: Logger = null;
  private _keyBindingOnChangeEmitterElementLifecycleBinder: OnChangeEmitterElementLifecycleBinder<KeyBindingsManager> = null;

  constructor() {
    super(KeyBindingsSettingsUi);
    this._log = getLogger(KEY_BINDINGS_SETTINGS_TAG, this);
    this._keyBindingOnChangeEmitterElementLifecycleBinder =
      new OnChangeEmitterElementLifecycleBinder<KeyBindingsManager>(this._handleKeyBindingsManagerChange.bind(this));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._keyBindingOnChangeEmitterElementLifecycleBinder.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._keyBindingOnChangeEmitterElementLifecycleBinder.disconnectedCallback();
  }

  private _handleKeyBindingsManagerChange(keyBindingsManager: KeyBindingsManager): void {
    if (keyBindingsManager == null) {
      return;
    }
    this._getUi().setKeyBindingsContexts(keyBindingsManager.getKeyBindingsContexts());
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

  set keyBindingManager(keyBindingsManager: KeyBindingsManager) {
    this._keyBindingOnChangeEmitterElementLifecycleBinder.setOnChangeEmitter(keyBindingsManager);
    if (keyBindingsManager == null) {
      return;
    }
    this._getUi().setKeyBindingsContexts(keyBindingsManager.getKeyBindingsContexts());
  }

  get keyBindingManager(): KeyBindingsManager {
    return this._keyBindingOnChangeEmitterElementLifecycleBinder.getOnChangeEmitter();
  }
}
