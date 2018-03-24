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
import { SettingsUi, nextId, IdentifiableCommandLineAction, Identifiable } from './SettingsUi';


@WebComponent({tag: "et-settings-tab"})
export class SettingsTab extends ViewerElement implements AcceptsConfigDistributor {
  
  static TAG_NAME = "ET-SETTINGS-TAB";
  
  private _log: Logger = null;
  private _ui: SettingsUi = null;
  private _configManager: ConfigDistributor = null;
  private _configManagerDisposable: Disposable = null;
  private _themes: ThemeTypes.ThemeInfo[] = [];
  private _fontOptions: FontInfo[] = [];

  constructor() {
    super();
    this._log = getLogger(SettingsTab.TAG_NAME, this);

    this._ui = new SettingsUi();
    const component = this._ui.$mount();
    this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } )

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
  
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._configManagerDisposable !== null) {
      this._configManagerDisposable.dispose();
      this._configManagerDisposable = null;
    }
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
    this._configManager = configDistributor;
    this._configManagerDisposable = configDistributor.onChange(() => {
      this._setConfig(configDistributor.getConfig());
    });
    this._setConfig(configDistributor.getConfig());
    this._ui.configDistributor = configDistributor;
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
    
    if (this._ui.terminalFontSize !== config.terminalFontSize) {
      this._ui.terminalFontSize = config.terminalFontSize;
    }
    
    if (this._ui.terminalFont !== config.terminalFont) {
      this._ui.terminalFont = config.terminalFont;
    }
    
    if (this._ui.uiScalePercent !== config.uiScalePercent) {
      this._ui.uiScalePercent = config.uiScalePercent;
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
      this._ui.terminalFontOptions = newFontOptions;
    }
  
    const cleanCommandLineAction = _.cloneDeep(this._ui.commandLineActions);
    stripIds(cleanCommandLineAction);
    
    this._ui.themeTerminal = config.themeTerminal;
    this._ui.themeSyntax = config.themeSyntax;
    this._ui.themeGUI = config.themeGUI;
    this._ui.titleBar = config.showTitleBar ? "native" : "theme";
    this._ui.currentTitleBar = config.systemConfig.titleBarVisible ? "native" : "theme";

    if ( ! _.isEqual(cleanCommandLineAction, config.commandLineActions)) {
      const updateCLA = <IdentifiableCommandLineAction[]> _.cloneDeep(config.commandLineActions);
      setIds(updateCLA);
      this._ui.commandLineActions = updateCLA;
    }
  }

  setThemes(themes: ThemeTypes.ThemeInfo[]): void {
    this._themes = themes;

    const getThemesByType = (type: ThemeTypes.ThemeType): ThemeTypes.ThemeInfo[] => {
      const themeTerminalOptions = this._themes
        .filter( (themeInfo) => themeInfo.type.indexOf(type) !== -1 );
      return _.sortBy(themeTerminalOptions, (themeInfo: ThemeTypes.ThemeInfo): string => themeInfo.name );
    };

    this._ui.themeTerminalOptions = getThemesByType("terminal");
    this._ui.themeSyntaxOptions = getThemesByType("syntax");
    this._ui.themeGUIOptions = getThemesByType("gui");
  }

  private _dataChanged(): void {
    const newConfig = _.cloneDeep(this._configManager.getConfig());
    
    newConfig.showTips = this._ui.showTips;
    newConfig.scrollbackMaxLines = this._ui.maxScrollbackLines;
    newConfig.scrollbackMaxFrames = this._ui.maxScrollbackFrames;
    newConfig.terminalFontSize = this._ui.terminalFontSize;
    newConfig.terminalFont = this._ui.terminalFont;
    newConfig.themeTerminal = this._ui.themeTerminal;
    newConfig.themeSyntax = this._ui.themeSyntax;
    newConfig.themeGUI = this._ui.themeGUI;
    newConfig.showTitleBar = this._ui.titleBar === "native";
    newConfig.uiScalePercent = this._ui.uiScalePercent;

    const commandLineActions = _.cloneDeep(this._ui.commandLineActions);
    stripIds(commandLineActions);
    newConfig.commandLineActions = commandLineActions;

    this._configManager.setConfig(newConfig);
  }
}

function setIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id === undefined) {
      idable.id = nextId();
    }
  });
}

function stripIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id !== undefined) {
      delete idable.id;
    }
  });  
}
