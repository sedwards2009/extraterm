/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Config, ConfigDistributor } from '../../Config';
import { Disposable } from 'extraterm-extension-api';

/**
 * Binds the handling of a ConfigDistributor and Config
 * with the lifecycle of an element.
 */
export class ConfigElementBinder {
  private _connected = false;
  private _configDistributor: ConfigDistributor = null;
  private _configDistributorDisposable: Disposable = null;

  constructor(private _onConfigChange: (newConfig: Config) => void) {
  }

  setConfigDistributor(configDistributor: ConfigDistributor): void {
    if (this._configDistributor === configDistributor) {
      return;
    }

    this._stopHandle();
    this._configDistributor = configDistributor;

    if (this._connected) {
      this._configDistributorDisposable = this._configDistributor.onChange(this._handleOnChange.bind(this));
      this._handleOnChange();
    }
  }

  getConfigDistributor(): ConfigDistributor {
    return this._configDistributor;
  }

  private _stopHandle(): void {
    if (this._configDistributorDisposable != null) {
      this._configDistributorDisposable.dispose();
      this._configDistributorDisposable = null;
    }
  }

  private _handleOnChange(): void {
    if (this._configDistributor != null && this._configDistributor.getConfig() != null) {
      this._onConfigChange(this._configDistributor.getConfig());
    }
  }

  connectedCallback(): void {
    if (this._configDistributor != null) {
      this._configDistributorDisposable = this._configDistributor.onChange(this._handleOnChange.bind(this));
    }

    this._connected = true;

    if (this._configDistributor != null) {
      this._handleOnChange();
    }
  }

  disconnectedCallback(): void {
    this._stopHandle();
    this._connected = false;
  }
}
