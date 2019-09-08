/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {WebComponent} from 'extraterm-web-component-decorators';
import {ViewerMetadata} from 'extraterm-extension-api';

import * as ThemeTypes from '../theme/Theme';
import {ViewerElement} from './viewers/ViewerElement';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as DomUtils from './DomUtils';
import {shell} from 'electron';
import {Logger, getLogger} from "extraterm-logging";
import { AcceptsConfigDatabase, ConfigDatabase, SYSTEM_CONFIG } from '../Config';

const ID_ABOUT = "ID_ABOUT";


/**
 * The Extraterm About tab.
 */
@WebComponent({tag: "et-about-tab"})
export class AboutTab extends ViewerElement implements AcceptsConfigDatabase {
  
  static TAG_NAME = "ET-ABOUT-TAB";

  private _log: Logger = null;
  private _configDatabase: ConfigDatabase = null;

  constructor() {
    super();
    this._log = getLogger(AboutTab.TAG_NAME, this);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = "About";
    metadata.icon = "far fa-lightbulb";
    return metadata;
  }

  focus(): void {
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    return false;
  }

  setConfigDatabase(newConfigDatabase: ConfigDatabase): void {
    this._configDatabase = newConfigDatabase;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) == null) {
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      const themeStyle = document.createElement('style');
      themeStyle.id = ThemeableElementBase.ID_THEME;
      
      const divContainer = document.createElement('div');
      divContainer.innerHTML = `<div id='${ID_ABOUT}'>
  <h1>Extraterm</h1>
  <h3>version ${this._configDatabase.getConfig(SYSTEM_CONFIG).applicationVersion}</h3>
  <p>Copyright &copy; 2015-2019 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See <a href="http://extraterm.org">extraterm.org</a> and <a href="https://github.com/sedwards2009/extraterm">https://github.com/sedwards2009/extraterm</a></p>
  <hr>
  <p>Extraterm logos were designed and provided by <a href="https://github.com/g-harel">Gabriel Harel (https://github.com/g-harel)</a>.</p>
  <p>This software uses Twemoji for color emoji under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. <a href="https://twemoji.twitter.com/">https://twemoji.twitter.com/</a></p>
</div>
`;

      shadow.appendChild(themeStyle);
      shadow.appendChild(divContainer);
      divContainer.addEventListener('click', this._handleClick.bind(this));

      this.updateThemeCss();
    }
  }

  private _handleClick(ev: MouseEvent): void {
    ev.preventDefault();
    if ((<HTMLElement> ev.target).tagName === "A") {
      const href = (<HTMLAnchorElement> ev.target).href;
      shell.openExternal(href);
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.ABOUT_TAB];
  }
}
