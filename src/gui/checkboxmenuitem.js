define(["gui/menuitem", "gui/util"], function(menuitem, util) {

var CbCheckBoxMenuItemProto = Object.create(menuitem.prototype);

var CHECKED_ATTR = "checked";

CbCheckBoxMenuItemProto._id = "CbCheckBoxMenuItemTemplate";

CbCheckBoxMenuItemProto.createdCallback = function() {
  menuitem.prototype.createdCallback.call(this);
  updateChecked.call(this, this.getAttribute(CHECKED_ATTR));
};

CbCheckBoxMenuItemProto._clicked = function() {
  var checked = this.getAttribute(CHECKED_ATTR);
  this.setAttribute(CHECKED_ATTR, ! util.htmlValueToBool(checked));
};

CbCheckBoxMenuItemProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  menuitem.prototype.attributeChangedCallback.call(this, attrName, oldValue, newValue);
  
  if (attrName === CHECKED_ATTR) {
    updateChecked.call(this, newValue);
  }
};

function updateChecked(checked) {
  var checkedhtml;
  var shadow = util.getShadowRoot(this);

  checkedhtml = "<i class='fa fa-fw fa-" + (util.htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
  shadow.querySelector("#icon1").innerHTML = checkedhtml; 
}

var CbCheckBoxMenuItem = window.document.registerElement('cb-checkboxmenuitem', {prototype: CbCheckBoxMenuItemProto});
return CbCheckBoxMenuItem;
});

