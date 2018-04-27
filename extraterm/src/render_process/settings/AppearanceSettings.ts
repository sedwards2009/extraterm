/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import { WebComponent } from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { AppearanceSettingsUi } from './AppearanceSettingsUi';
import { FontInfo, GeneralConfig, GENERAL_CONFIG, ConfigKey, SYSTEM_CONFIG, SystemConfig } from '../../Config';
import { Logger, getLogger } from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';
import * as ThemeTypes from '../../theme/Theme';

export const APPEARANCE_SETTINGS_TAG = "et-appearance-settings";

@WebComponent({tag: APPEARANCE_SETTINGS_TAG})
export class AppearanceSettings extends SettingsBase<AppearanceSettingsUi> {
  private _log: Logger = null;
  private _fontOptions: FontInfo[] = [];

  constructor() {
    super(AppearanceSettingsUi, [GENERAL_CONFIG, SYSTEM_CONFIG]);
    this._log = getLogger(APPEARANCE_SETTINGS_TAG, this);
  }

  protected _setConfig(key: ConfigKey, config: any): void {
    if (key === SYSTEM_CONFIG) {
      const ui = this._getUi();
      const systemConfig = <SystemConfig> config;
      ui.currentTitleBar = systemConfig.titleBarVisible ? "native" : "theme";
      const newFontOptions = [...systemConfig.availableFonts];
      newFontOptions.sort( (a,b) => {
        if (a.name === b.name) {
          return 0;
        }
        return a.name < b.name ? -1 : 1;
      });
      
      if ( ! _.isEqual(this._fontOptions, newFontOptions)) {
        this._fontOptions = newFontOptions;
        ui.terminalFontOptions = newFontOptions;
      }
    }
    
    if (key === GENERAL_CONFIG) {
      const ui = this._getUi();
      const generalConfig = <GeneralConfig> config;
      ui.terminalFont = generalConfig.terminalFont;
      ui.terminalFontSize = generalConfig.terminalFontSize;
      ui.themeGUI = generalConfig.themeGUI;
      ui.themeSyntax = generalConfig.themeSyntax;
      ui.themeTerminal = generalConfig.themeTerminal;
      ui.titleBar = generalConfig.showTitleBar ? "native" : "theme";
      ui.uiScalePercent = generalConfig.uiScalePercent;
    }
  }

  protected _dataChanged(): void {
    const newConfig = <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
    const ui = this._getUi();

    newConfig.showTitleBar = ui.titleBar === "native";
    newConfig.terminalFont = ui.terminalFont;
    newConfig.terminalFontSize = ui.terminalFontSize;
    newConfig.themeGUI = ui.themeGUI;
    newConfig.themeSyntax = ui.themeSyntax;
    newConfig.themeTerminal = ui.themeTerminal;
    newConfig.uiScalePercent = ui.uiScalePercent;
    
    this._updateConfig(GENERAL_CONFIG, newConfig);
  }

  set themes(themes: ThemeTypes.ThemeInfo[]) {
    this._getUi().themes = themes;
  }
}
