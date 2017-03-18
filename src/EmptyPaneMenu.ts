/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Empty Pane Menu tab

"use strict";

import * as ThemeTypes from './Theme';
import {ThemeableElementBase} from './ThemeableElementBase';
import {ListPicker} from './gui/ListPicker';
import * as DomUtils from './DomUtils';

const ID_EMPTY_PANE_MENU = "ID_EMPTY_PANE_MENU";
const ID_LIST_PICKER = "ID_LIST_PICKER";
const ID_CONTAINER = "ID_CONTAINER";
const ID_TITLE = "ID_TITLE";

let registered = false;

ListPicker.init();

/**
 * The Extraterm Empty Pane Menu.
 */
export class EmptyPaneMenu extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-EMPTY-PANE-MENU";

  /**
   * Initialize the EmptyPaneMenu class and resources.
   *
   * When EmptyPaneMenu is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EmptyPaneMenu.TAG_NAME, {prototype: EmptyPaneMenu.prototype});
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
    super.attachedCallback();
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const themeStyle = document.createElement('style');
    themeStyle.id = ThemeableElementBase.ID_THEME;
    
    const divContainer = document.createElement('div');
    divContainer.id = ID_EMPTY_PANE_MENU;
    divContainer.innerHTML = `<div id="${ID_CONTAINER}">
      <div id="${ID_TITLE}">Pane Menu</div>
      <${ListPicker.TAG_NAME} id="${ID_LIST_PICKER}"></${ListPicker.TAG_NAME}>
    </div>
`;

    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);    
    
    this.updateThemeCss();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.EMPTY_PANE_MENU];
    // return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.EMPTY_PANE_MENU];
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
