/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { ConfigDatabase, ConfigKey } from '../../Config';
import { ConfigElementLifecycleBinder } from './ConfigElementLifecycleBinder';
import { ThemeableElementBase } from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import Vue from 'vue';


export abstract class SettingsBase<V extends Vue> extends ThemeableElementBase {
  private _configBinder: ConfigElementLifecycleBinder = null;
  private _ui: V;
  private _isMounted = false;

  constructor(uiConstructor: { new(): V}, keys: ConfigKey[]) {
    super();
    this._configBinder = new ConfigElementLifecycleBinder(
      (key: ConfigKey, config: any): void => this._handleConfigChange(key, config), keys);

    this._ui = new uiConstructor();
    this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;
    shadow.appendChild(themeStyle);
    
    this.updateThemeCss();    
  }

  private _handleConfigChange(key: ConfigKey, config: any): void {
    this._setConfig(key, config);
  }

  protected _getUi(): V {
    return this._ui;
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  set configDatabase(configDatabase: ConfigDatabase) {
    this._configBinder.setConfigDatabase(configDatabase);
  }

  get configDatabase(): ConfigDatabase {
    return this._configBinder.getConfigDatabase();
  }

  connectedCallback(): void {
    super.connectedCallback();

    if ( ! this._isMounted) {
      const component = this._ui.$mount();
      this.shadowRoot.appendChild(component.$el);
      this._isMounted = true;
    }

    this._configBinder.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._configBinder.disconnectedCallback();
  }

  protected _getConfigCopy(key: ConfigKey): any {
    if (this._configBinder.getConfigDatabase() != null) {
      return this._configBinder.getConfigDatabase().getConfigCopy(key);
    }
    return null;
  }

  protected _getConfig(key: ConfigKey): any {
    if (this._configBinder.getConfigDatabase() != null) {
      return this._configBinder.getConfigDatabase().getConfig(key);
    }
    return null;
  }

  protected _updateConfig(key: ConfigKey, newConfig: any): void {
    if (this._configBinder.getConfigDatabase() != null) {
      this._configBinder.getConfigDatabase().setConfig(key, newConfig);
    }
  }

  protected abstract _setConfig(key: ConfigKey, config: any): void;
  protected abstract _dataChanged(): void;
}
