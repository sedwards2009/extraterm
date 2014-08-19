///<reference path='../chrome_lib.d.ts'/>
import menuitem = require("./menuitem");
import util = require("./util");

var CHECKED_ATTR = "checked";
var _id = "CbCheckBoxMenuItemTemplate";

class CbCheckBoxMenuItem extends menuitem {

  createdCallback() {
    super.createdCallback();
    this.updateChecked(this.getAttribute(CHECKED_ATTR));
  }

  _clicked() {
    var checked:string = this.getAttribute(CHECKED_ATTR);
    this.setAttribute(CHECKED_ATTR, (! util.htmlValueToBool(checked)) ? "true" : "false");
  }

  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(attrName, oldValue, newValue);

    if (attrName === CHECKED_ATTR) {
      this.updateChecked(newValue);
    }
  }

  private updateChecked(checked: string) {
    var checkedhtml:string;
    var shadow = util.getShadowRoot(this);

    checkedhtml = "<i class='fa fa-fw fa-" + (util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
    shadow.querySelector("#icon1").innerHTML = checkedhtml; 
  }
}

window.document.registerElement('cb-checkboxmenuitem', {prototype: CbCheckBoxMenuItem.prototype});
export = CbCheckBoxMenuItem;
