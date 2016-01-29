/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

// About tab

"use strict";

import ViewerElement  = require('./viewerelement');
import domutils = require('./domutils');

let registered = false;

class EtAboutTab extends ViewerElement {
  
  static TAG_NAME = "et-about-tab";

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
  
  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    const shadow = domutils.createShadowRoot(this);
    const style = document.createElement('style');
    style.innerHTML = `
    `;
    const divContainer = document.createElement('div');
    divContainer.innerHTML = `<h1>Extraterm</h1>
<h2>Copyright &copy; 2015-2016 Simon Edwards &lt;simon@simonzone.com&gt;</h2>
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
