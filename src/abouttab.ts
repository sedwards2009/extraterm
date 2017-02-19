/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// About tab

"use strict";

import * as ThemeTypes from './Theme';
import ViewerElement  = require('./viewerelement');
import ViewerElementTypes = require('./viewerelementtypes');
import ThemeableElementBase = require('./themeableelementbase');
import * as DomUtils from './DomUtils';
import BulkDOMOperation = require('./BulkDOMOperation');

const ID_ABOUT = "ID_ABOUT";

let registered = false;

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

  getMode(): ViewerElementTypes.Mode {
    return ViewerElementTypes.Mode.DEFAULT;
  }

  bulkSetMode(mode: ViewerElementTypes.Mode): BulkDOMOperation.BulkDOMOperation {
    return BulkDOMOperation.nullOperation();
  }

  getVisualState(): ViewerElementTypes.VisualState {
    return ViewerElementTypes.VisualState.AUTO;
  }

  bulkSetVisualState(state: ViewerElementTypes.VisualState): BulkDOMOperation.BulkDOMOperation {
    return BulkDOMOperation.nullOperation();
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
    super.attachedCallback();
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const themeStyle = document.createElement('style');
    themeStyle.id = ThemeableElementBase.ID_THEME;
    
    const divContainer = document.createElement('div');
    divContainer.innerHTML = `<div id='${ID_ABOUT}'>
  <h1>Extraterm</h1>
  <p>Copyright &copy; 2015-2017 Simon Edwards &lt;simon@simonzone.com&gt;</p>
  <p>Published under the MIT license</p>
  <p>See https://github.com/sedwards2009/extraterm</p>
  <hr>
  <p>This software uses EmojiOne for color emoji under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. http://emojione.com</p>
</div>
`;

    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);    
    
    this.updateThemeCss();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.ABOUT_TAB];
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
}

export = EtAboutTab;
