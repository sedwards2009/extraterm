/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import CbMenuItem = require('./menuitem');
import domutils = require('../domutils');
import util = require('./util');

const ID = "CbCheckBoxMenuItemTemplate";

let registered = false;

/**
 * A check box menu item for use inside a context menu.
 */
class CbCheckBoxMenuItem extends CbMenuItem {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-CHECKBOXMENUITEM';
  
  static ATTR_CHECKED = "checked";
  
  /**
   * Initialize the CbCheckBoxMenuItem class and resources.
   *
   * When CbCheckBoxMenuItem is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbCheckBoxMenuItem.TAG_NAME, {prototype: CbCheckBoxMenuItem.prototype});
      registered = true;
    }
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
  createdCallback() {
    super.createdCallback();
  }
  
  attachedCallback(): void {
    super.attachedCallback();
    this._updateChecked(this.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED));
  }

  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(attrName, oldValue, newValue);

    if (attrName === CbCheckBoxMenuItem.ATTR_CHECKED) {
      this._updateChecked(newValue);
    }
  }

  //-----------------------------------------------------------------------
  set checked(checked: boolean) {
    this.setAttribute(CbCheckBoxMenuItem.ATTR_CHECKED, util.booleanToString(checked));
  }

  get checked(): boolean {
    return util.htmlValueToBool(this.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED));
  }

  //-----------------------------------------------------------------------
  _clicked(): void {
    const checked = this.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED);
    this.setAttribute(CbCheckBoxMenuItem.ATTR_CHECKED, (! util.htmlValueToBool(checked)) ? "true" : "false");
  }

  private _updateChecked(checked: string): void {
    const shadow = domutils.getShadowRoot(this);
    const checkedhtml = "<i class='fa fa-fw fa-" + (util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
    (<HTMLDivElement>shadow.querySelector("#" + CbMenuItem.ID_ICON1)).innerHTML = checkedhtml; 
  }
}

export = CbCheckBoxMenuItem;
