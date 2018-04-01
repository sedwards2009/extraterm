/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import * as _ from 'lodash';
import Vue from 'vue';

import { AppearanceSettingsUi } from './AppearanceSettingsUi';
import { Config, FontInfo } from '../../Config';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import { SettingsBase } from './SettingsBase';
import * as ThemeTypes from '../../theme/Theme';

export const APPEARANCE_SETTINGS_TAG = "et-appearance-settings";

@WebComponent({tag: APPEARANCE_SETTINGS_TAG})
export class AppearanceSettings extends SettingsBase<AppearanceSettingsUi> {
  private _log: Logger = null;
  private _fontOptions: FontInfo[] = [];

  constructor() {
    super(AppearanceSettingsUi);
    this._log = getLogger(APPEARANCE_SETTINGS_TAG, this);
  }

  protected _setConfig(config: Config): void {
    const ui = this._getUi();

    ui.terminalFontSize = config.terminalFontSize;
    ui.themeTerminal = config.themeTerminal;
    ui.themeSyntax = config.themeSyntax;
    ui.themeGUI = config.themeGUI;
    ui.titleBar = config.showTitleBar ? "native" : "theme";
    ui.currentTitleBar = config.systemConfig.titleBarVisible ? "native" : "theme";
    
    if (ui.uiScalePercent !== config.uiScalePercent) {
      ui.uiScalePercent = config.uiScalePercent;
    }

    if (ui.terminalFont !== config.terminalFont) {
      ui.terminalFont = config.terminalFont;
    }

    const newFontOptions = [...config.systemConfig.availableFonts];
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

  protected _dataChanged(): void {
    const newConfig = this._getConfigCopy();
    const ui = this._getUi();

    newConfig.terminalFontSize = ui.terminalFontSize;
    newConfig.themeTerminal = ui.themeTerminal;
    newConfig.themeSyntax = ui.themeSyntax;
    newConfig.themeGUI = ui.themeGUI;
    newConfig.showTitleBar = ui.titleBar === "native";
    newConfig.uiScalePercent = ui.uiScalePercent;
    
    this._updateConfig(newConfig);
  }

  set themes(themes: ThemeTypes.ThemeInfo[]) {
    this._getUi().themes = themes;
  }
}
