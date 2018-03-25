/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';

import { ConfigDistributor, Config } from '../../Config';
import { ThemeableElementBase } from '../ThemeableElementBase';
import { ConfigElementBinder } from './ConfigElementBinder';
import Vue from 'vue';


export abstract class SettingsBase extends ThemeableElementBase {
  private _configBinder: ConfigElementBinder = null;

  constructor() {
    super();
    this._configBinder = new ConfigElementBinder(this._setConfig.bind(this));

    const ui = this._createVueUi();
    const component = ui.$mount();
    ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;
    shadow.appendChild(themeStyle);
    
    this.updateThemeCss();
    
    shadow.appendChild(component.$el);
  }

  set configDistributor(configDistributor: ConfigDistributor) {
    this._configBinder.setConfigDistributor(configDistributor);
  }

  get configDistributor(): ConfigDistributor {
    return this._configBinder.getConfigDistributor();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._configBinder.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._configBinder.disconnectedCallback();
  }

  protected _getConfigCopy(): Config {
    if (this._configBinder.getConfigDistributor() != null) {
      const config = this._configBinder.getConfigDistributor().getConfig();
      if (config != null) {
        return _.cloneDeep(config);
      }
    }
    return null;
  }

  protected _updateConfig(newConfig: Config): void {
    if (this._configBinder.getConfigDistributor() != null) {
      this._configBinder.getConfigDistributor().setConfig(newConfig);
    }
  }
  
  protected abstract _createVueUi(): Vue;
  protected abstract _setConfig(config: Config): void;
  protected abstract _dataChanged(): void;
}
