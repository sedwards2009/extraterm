/**
 * Copyright 2018-2021 Simon Edwards <simon@simonzone.com>
 */
import { COMMAND_LINE_ACTIONS_CONFIG, GENERAL_CONFIG, SESSION_CONFIG, SYSTEM_CONFIG } from '../../Config';
import { ThemeableElementBase } from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import Vue from 'vue';
import { log } from 'extraterm-logging/dist/LogDecorator';
import { Disposable } from "@extraterm/extraterm-extension-api";
import { ConfigChangeEvent, ConfigDatabase, ConfigKey } from "../../ConfigDatabase";


export abstract class SettingsBase<V extends Vue> extends ThemeableElementBase {
  #configDatabase: ConfigDatabase = null;
  #configDatabaseEventDispose: Disposable = null;
  private _ui: V;
  private _isMounted = false;

  constructor(uiConstructor: { new(): V}) {
    super();

    this._ui = new uiConstructor();
    this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: false });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;
    shadow.appendChild(themeStyle);

    this.updateThemeCss();
  }

  protected _getUi(): V {
    return this._ui;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  set configDatabase(configDatabase: ConfigDatabase) {
    this._disposeConfigDatabaseOnChange();
    this.#configDatabase = configDatabase;
    if (this.#configDatabase == null) {
      return;
    }
    this._connectdConfigDatabaseOnChange();

    this._setConfigInUi(SYSTEM_CONFIG, this.#configDatabase.getSystemConfig());
    this._setConfigInUi(GENERAL_CONFIG, this.#configDatabase.getGeneralConfig());
    this._setConfigInUi(COMMAND_LINE_ACTIONS_CONFIG, this.#configDatabase.getCommandLineActionConfig());
    this._setConfigInUi(SESSION_CONFIG, this.#configDatabase.getSessionConfig());
  }

  get configDatabase(): ConfigDatabase {
    return this.#configDatabase;
  }

  private _connectdConfigDatabaseOnChange(): void {
    this._disposeConfigDatabaseOnChange();
    if (this.#configDatabase != null) {
      this.#configDatabaseEventDispose = this.#configDatabase.onChange((ev: ConfigChangeEvent) => {
        this._setConfigInUi(ev.key, ev.newConfig);
      });
    }
  }

  private _disposeConfigDatabaseOnChange(): void {
    if (this.#configDatabaseEventDispose != null) {
      this.#configDatabaseEventDispose.dispose();
      this.#configDatabaseEventDispose = null;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();

    if ( ! this._isMounted) {
      const component = this._ui.$mount();
      this.shadowRoot.appendChild(component.$el);
      this._isMounted = true;
    }

    this._connectdConfigDatabaseOnChange();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._disposeConfigDatabaseOnChange();
  }

  protected abstract _setConfigInUi(key: ConfigKey, config: any): void;
  protected abstract _dataChanged(): void;
}
