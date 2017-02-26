/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {MenuItem} from './MenuItem';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';

const ID = "EtCheckboxMenuItemTemplate";

let registered = false;

/**
 * A check box menu item for use inside a context menu.
 */
export class CheckboxMenuItem extends MenuItem {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'ET-CHECKBOXMENUITEM';
  
  static ATTR_CHECKED = "checked";
  
  /**
   * Initialize the CheckBoxMenuItem class and resources.
   *
   * When CheckBoxMenuItem is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CheckboxMenuItem.TAG_NAME, {prototype: CheckboxMenuItem.prototype});
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
    this._updateChecked(this.getAttribute(CheckboxMenuItem.ATTR_CHECKED));
  }

  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(attrName, oldValue, newValue);

    if (attrName === CheckboxMenuItem.ATTR_CHECKED) {
      this._updateChecked(newValue);
    }
  }

  //-----------------------------------------------------------------------
  setChecked(checked: boolean): void {
    this.setAttribute(CheckboxMenuItem.ATTR_CHECKED, Util.booleanToString(checked));
  }

  getChecked(): boolean {
    return Util.htmlValueToBool(this.getAttribute(CheckboxMenuItem.ATTR_CHECKED));
  }

  //-----------------------------------------------------------------------
  _clicked(): void {
    const checked = this.getAttribute(CheckboxMenuItem.ATTR_CHECKED);
    this.setAttribute(CheckboxMenuItem.ATTR_CHECKED, (! Util.htmlValueToBool(checked)) ? "true" : "false");
  }

  private _updateChecked(checked: string): void {
    const shadow = DomUtils.getShadowRoot(this);
    const checkedhtml = "<i class='fa fa-fw fa-" + (Util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
    (<HTMLDivElement>shadow.querySelector("#" + MenuItem.ID_ICON1)).innerHTML = checkedhtml; 
  }
}
