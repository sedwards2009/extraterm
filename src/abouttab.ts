/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// About tab

"use strict";

import ViewerElement  = require('./viewerelement');
import domutils = require('./domutils');

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
    const shadow = domutils.createShadowRoot(this);
    const style = document.createElement('style');
    style.innerHTML = `
    `;
    const divContainer = document.createElement('div');
    divContainer.innerHTML = `<h1>Extraterm</h1>
<p>Copyright &copy; 2015-2016 Simon Edwards &lt;simon@simonzone.com&gt;</p>
<p>Published under the MIT license</p>
<p>See https://github.com/sedwards2009/extraterm</p>
`;

    shadow.appendChild(style);
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
  
}

export = EtAboutTab;
