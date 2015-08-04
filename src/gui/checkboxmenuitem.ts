/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import menuitem = require("./menuitem");
import util = require("./util");

const ID = "CbCheckBoxMenuItemTemplate";

let registered = false;

class CbCheckBoxMenuItem extends menuitem {
  
  static TAG_NAME = 'cb-checkboxmenuitem';
  
  static ATTR_CHECKED = "checked";
  
  //-----------------------------------------------------------------------
  // Statics

  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbCheckBoxMenuItem.TAG_NAME, {prototype: CbCheckBoxMenuItem.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  
  createdCallback() {
    super.createdCallback();
    this._updateChecked(this.getAttribute(CbCheckBoxMenuItem.ATTR_CHECKED));
  }

  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(attrName, oldValue, newValue);

    if (attrName === CbCheckBoxMenuItem.ATTR_CHECKED) {
      this._updateChecked(newValue);
    }
  }

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
    const shadow = util.getShadowRoot(this);
    const checkedhtml = "<i class='fa fa-fw fa-" + (util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
    (<HTMLDivElement>shadow.querySelector("#icon1")).innerHTML = checkedhtml; 
  }
}

export = CbCheckBoxMenuItem;
