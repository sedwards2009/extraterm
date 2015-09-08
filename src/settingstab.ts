/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";

import ViewerElement  = require("./viewerelement");
import util = require("./gui/util");
import React = require("react");
import settingspane = require("./settingspane");
import config = require('./config');
import globalcss = require('./gui/globalcss');

type Config = config.Config;

const ID = "EtSettingsTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

let registered = false;

class EtSettingsTab extends ViewerElement {
  
  static TAG_NAME = "et-settings-tab";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtSettingsTab.TAG_NAME, {prototype: EtSettingsTab.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _config: Config;
  
  private _settingsPane: settingspane.SettingsPane;
  
  protected _initProperties(): void {
    this._config = null;
    this._settingsPane = null;
  }
    
  get awesomeIcon(): string {
    return "wrench";
  }
  
  get title(): string {
    return "Settings";
  }

  focus(): void {
    util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    const root = util.getShadowRoot(this);
    return root.activeElement !== null;
  }
  
  set config(config: Config) {
    this._config = config;
    if (this._settingsPane !== null) {
      this._settingsPane.config = config;
    }
  }

  createdCallback(): void {
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);

    const pane = React.createElement(settingspane.SettingsPane, {config: this._config});
    this._settingsPane = <settingspane.SettingsPane> React.render(pane, util.getShadowId(this, ID_CONTAINER));
  }

  /**
   * 
   */
  private createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `
      <style id="${ID_MAIN_STYLE}">
        ${globalcss.topcoatCSS()}
        ${globalcss.fontAwesomeCSS()}

        :host {
          display: block;
          width: 100%;
          height: 100%;
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
          height: 100%;
          width: 100%;
          overflow: auto;
        }
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }

        DIV.settingspane {
          max-width: 800px;
        }
        
        DIV.settingsform {
          display: grid;
          grid-template-columns: 80px 1fr;
          grid-auto-rows: 1.5em;
        }
        
        DIV.noframepatterns {
          display: grid;
          width: 100%;
          max-width: 320px;
          grid-template-columns: 1fr auto;
          grid-auto-rows: auto;
        }
        
        DIV.noframepatterns > * {
          margin-top: 0.25em;
          margin-bottom: 0.25em;      
        }
        
        INPUT.noframepattern {
          width: 100%;
        }
        
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id="${ID_CONTAINER}" tabIndex="-1" class=""></div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  _themeCssSet(): void {  
    const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    if (themeTag !== null) {
      themeTag.innerHTML = this.getThemeCss();
    }
  }
}

export = EtSettingsTab;
