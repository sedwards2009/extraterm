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
import { AcceptsKeyBindingManager, KeyBindingManager } from '../keybindings/KeyBindingManager';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as ThemeTypes from '../../theme/Theme';
import { SettingsUi } from './SettingsUi';
import {ConfigElementBinder} from './ConfigElementBinder';


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements AcceptsConfigDistributor, AcceptsKeyBindingManager {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _configBinder: ConfigElementBinder = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _keyBindingManager: KeyBindingManager = null;

  constructor() {
    super();
    this._log = getLogger(SettingsTab.TAG_NAME, this);
    this._configBinder = new ConfigElementBinder(this._setConfig.bind(this));

    this._ui = new SettingsUi();
    const component = this._ui.$mount();

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
  
  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = newKeyBindingManager;
    this._ui.setKeyBindingManager(newKeyBindingManager);
  }

  private _setConfig(config: Config): void {
  }

  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._ui.themes = themes;
  }
}
