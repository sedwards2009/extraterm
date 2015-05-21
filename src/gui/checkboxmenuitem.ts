import menuitem = require("./menuitem");
import util = require("./util");

var CHECKED_ATTR = "checked";
var ID = "CbCheckBoxMenuItemTemplate";

var registered = false;

class CbCheckBoxMenuItem extends menuitem {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-checkboxmenuitem', {prototype: CbCheckBoxMenuItem.prototype});
      registered = true;
    }
  }

  createdCallback() {
    super.createdCallback();
    this.updateChecked(this.getAttribute(CHECKED_ATTR));
  }

  _clicked(): void {
    var checked = this.getAttribute(CHECKED_ATTR);
    this.setAttribute(CHECKED_ATTR, (! util.htmlValueToBool(checked)) ? "true" : "false");
  }

  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    super.attributeChangedCallback(attrName, oldValue, newValue);

    if (attrName === CHECKED_ATTR) {
      this.updateChecked(newValue);
    }
  }

  private updateChecked(checked: string): void {
    var shadow = util.getShadowRoot(this);
    var checkedhtml = "<i class='fa fa-fw fa-" + (util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
    (<HTMLDivElement>shadow.querySelector("#icon1")).innerHTML = checkedhtml; 
  }
}

export = CbCheckBoxMenuItem;
