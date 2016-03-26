/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// About tab

"use strict";

import ThemeTypes = require('./theme');
import ViewerElement  = require('./viewerelement');
import domutils = require('./domutils');

const ID_ABOUT = "ID_ABOUT";
const ID_THEME = "ID_THEME";

let registered = false;
// Theme management
const activeInstances: Set<EtAboutTab> = new Set();
let themeCss = "";

/**
 * The Extraterm About tab.
 */
class EtAboutTab extends ViewerElement {
  
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
      window.document.registerElement(EtAboutTab.TAG_NAME, {prototype: EtAboutTab.prototype});
      registered = true;
    }
  }
  
  // Static method from the ThemeTypes.Themeable interface.
  static getThemeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.ABOUT_TAB];
  }
  
  // Static method from the ThemeTypes.Themeable interface.
  static setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {
    themeCss = cssMap.get(ThemeTypes.CssFile.GUI_CONTROLS) + "\n" + cssMap.get(ThemeTypes.CssFile.ABOUT_TAB);
    activeInstances.forEach( (instance) => {
      instance._setThemeCss(themeCss);
    });
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  
  private _initProperties(): void {
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

  get awesomeIcon(): string {
    return "lightbulb-o";
  }
  
  get title(): string {
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

  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties();
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    activeInstances.add(this);
    
    const shadow = domutils.createShadowRoot(this);
    const themeStyle = document.createElement('style');
    themeStyle.id = ID_THEME;
    themeStyle.textContent = themeCss;
    
    const divContainer = document.createElement('div');
    divContainer.innerHTML = `<div id='${ID_ABOUT}'>
  <h1>Extraterm</h1>
  <p>Copyright &copy; 2015-2016 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See https://github.com/sedwards2009/extraterm</p>
</div>
`;

    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);    
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                      
  // #     # #####  # #    #   ##   ##### ###### 
  // #     # #    # # #    #  #  #    #   #      
  // ######  #    # # #    # #    #   #   #####  
  // #       #####  # #    # ######   #   #      
  // #       #   #  #  #  #  #    #   #   #      
  // #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  private _setThemeCss(cssText: string): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    
    (<HTMLStyleElement> domutils.getShadowId(this, ID_THEME)).textContent = cssText;
  }
}

// This line below acts an assertion on the constructor function.
const themeable: ThemeTypes.Themeable = EtAboutTab;

export = EtAboutTab;
