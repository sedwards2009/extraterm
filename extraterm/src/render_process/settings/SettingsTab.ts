/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata, Disposable} from 'extraterm-extension-api';

import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import { AcceptsConfigDatabase, ConfigDatabase } from '../../Config';
import { AcceptsKeyBindingsManager, KeyBindingsManager } from '../keybindings/KeyBindingsManager';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ThemeTypes from '../../theme/Theme';
import { SettingsUi } from './SettingsUi';
import { AcceptsExtensionManager, ExtensionManager } from '../extension/InternalTypes';


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements AcceptsConfigDatabase, AcceptsKeyBindingsManager,
    AcceptsExtensionManager {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _keyBindingManager: KeyBindingsManager = null;

  constructor() {
    super();
    this._log = getLogger(SettingsTab.TAG_NAME, this);

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
    metadata.icon = "fa fa-wrench";
    return metadata;
  }

  setSelectedTab(tabName: string): void {
    this._ui.selectedTab = tabName;
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

  setConfigDatabase(configDatabase: ConfigDatabase): void {
    this._ui.setConfigDatabase(configDatabase);
  }
  
  setKeyBindingsManager(newKeyBindingManager: KeyBindingsManager): void {
    this._keyBindingManager = newKeyBindingManager;
    this._ui.setKeyBindingsManager(newKeyBindingManager);
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._ui.setExtensionManager(extensionManager);
  }
  
  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._ui.themes = themes;
  }
}
