/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';

import { ConfigDatabase, Config } from '../../Config';
import { OnChangeEmitterElementLifecycleBinder } from './OnChangeEmitterElementLifecycleBinder';
import { ThemeableElementBase } from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import Vue from 'vue';


export abstract class SettingsBase<V extends Vue> extends ThemeableElementBase {
  private _configBinder: OnChangeEmitterElementLifecycleBinder<ConfigDatabase> = null;
  private _ui: V;

  constructor(uiConstructor: { new(): V}) {
    super();
    this._configBinder = new OnChangeEmitterElementLifecycleBinder<ConfigDatabase>(this._handleConfigChange.bind(this));

    this._ui = new uiConstructor();
    const component = this._ui.$mount();
    this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;
    shadow.appendChild(themeStyle);
    
    this.updateThemeCss();
    
    shadow.appendChild(component.$el);
  }

  private _handleConfigChange(configDistributor: ConfigDatabase): void {
    if (configDistributor.getConfig() == null) {
      return;
    }
    this._setConfig(configDistributor.getConfigCopy());
  }

  protected _getUi(): V {
    return this._ui;
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  set configDistributor(configDistributor: ConfigDatabase) {
    this._configBinder.setOnChangeEmitter(configDistributor);
  }

  get configDistributor(): ConfigDatabase {
    return this._configBinder.getOnChangeEmitter();
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
    if (this._configBinder.getOnChangeEmitter() != null) {
      return this._configBinder.getOnChangeEmitter().getConfigCopy();
    }
    return null;
  }

  protected _updateConfig(newConfig: Config): void {
    if (this._configBinder.getOnChangeEmitter() != null) {
      this._configBinder.getOnChangeEmitter().setConfig(newConfig);
    }
  }

  protected abstract _setConfig(config: Config): void;
  protected abstract _dataChanged(): void;
}
