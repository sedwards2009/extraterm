/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import * as _ from 'lodash';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import Vue from 'vue';

import { AcceptsConfigDistributor, ConfigDistributor, FontInfo, Config } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as ThemeTypes from '../../theme/Theme';
import { SettingsUi } from './SettingsUi';
import {ConfigElementBinder} from './ConfigElementBinder';


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements AcceptsConfigDistributor {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _configBinder: ConfigElementBinder = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];

  constructor() {
    super();
    this._log = getLogger(SettingsTab.TAG_NAME, this);
    this._configBinder = new ConfigElementBinder(this._setConfig.bind(this));

    this._ui = new SettingsUi();
    const component = this._ui.$mount();
    this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;

    shadow.appendChild(themeStyle);
    
    this.updateThemeCss();
    
    shadow.appendChild(component.$el);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Settings";
    metadata.icon = "wrench";
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._configBinder.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._configBinder.disconnectedCallback();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB, ThemeTypes.CssFile.FONT_AWESOME];
  }

  focus(): void {
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }

  setConfigDistributor(configDistributor: ConfigDistributor): void {
    this._configBinder.setConfigDistributor(configDistributor);
    this._ui.setConfigDistributor(configDistributor);
  }

  private _setConfig(config: Config): void {
    
    if (this._ui.showTips !== config.showTips) {
      this._ui.showTips = config.showTips;
    }
    
    // We take care to only update things which have actually changed.
    if (this._ui.maxScrollbackLines !== config.scrollbackMaxLines) {
      this._ui.maxScrollbackLines = config.scrollbackMaxLines;
    }

    if (this._ui.maxScrollbackFrames !== config.scrollbackMaxFrames) {
      this._ui.maxScrollbackFrames = config.scrollbackMaxFrames;
    }
    
  }

  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._ui.themes = themes;
  }

  private _dataChanged(): void {
    const newConfig = _.cloneDeep(this._configBinder.getConfigDistributor().getConfig());
    
    newConfig.showTips = this._ui.showTips;
    newConfig.scrollbackMaxLines = this._ui.maxScrollbackLines;
    newConfig.scrollbackMaxFrames = this._ui.maxScrollbackFrames;


    this._configBinder.getConfigDistributor().setConfig(newConfig);
  }
}

