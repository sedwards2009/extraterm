/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// About tab

"use strict";

import * as ThemeTypes from '../theme/Theme';
import {ViewerElement} from './viewers/ViewerElement';
import * as ViewerElementTypes from './viewers/ViewerElementTypes';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as DomUtils from './DomUtils';
import {shell} from 'electron';
import {Logger, getLogger} from '../logging/Logger';

const ID_ABOUT = "ID_ABOUT";

let registered = false;

/**
 * The Extraterm About tab.
 */
export class AboutTab extends ViewerElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-ABOUT-TAB";

  /**
   * Initialize the EtAboutTab class and resources.
   *
   * When EtAboutTab is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(AboutTab.TAG_NAME.toLowerCase(), AboutTab);
      registered = true;
    }
  }

  private _log: Logger;

  private _initProperties(): void {
    this._log = getLogger(AboutTab.TAG_NAME, this);
  }

  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------

  getAwesomeIcon(): string {
    return "lightbulb-o";
  }
  
  getTitle(): string {
    return "About";
  }

  focus(): void {
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    return false;
  }

  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------
   constructor() {
     super();
     this._initProperties();
   }

  /**
   * Custom Element 'connected' life cycle hook.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) == null) {
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      const themeStyle = document.createElement('style');
      themeStyle.id = ThemeableElementBase.ID_THEME;
      
      const divContainer = document.createElement('div');
      divContainer.innerHTML = `<div id='${ID_ABOUT}'>
  <h1>Extraterm</h1>
  <p>Copyright &copy; 2015-2017 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See <a href="http://extraterm.org">extraterm.org</a> and <a href="https://github.com/sedwards2009/extraterm">https://github.com/sedwards2009/extraterm</a></p>
  <hr>
  <p>Extraterm logos were designed and provided by <a href="https://github.com/g-harel">Gabriel Harel (https://github.com/g-harel)</a>.</p>
  <p>This software uses EmojiOne for color emoji under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. <a href="http://emojione.com">http://emojione.com</a></p>
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
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.ABOUT_TAB];
  }
}
