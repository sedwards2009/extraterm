define(["require", 'gui/util'], function(require, util) {

var CbMenuItemProto = Object.create(window.HTMLElement.prototype);;
var SELECTED_ATTR = "selected";

CbMenuItemProto._id = "CbMenuItemTemplate";

CbMenuItemProto._css = function() {
  return "@import url('" + require.toUrl("../css/font-awesome.css") + "');\n"
      + ":host {\n"
      + "    display: block;\n"
      + "    color: #000;\n"
      + "    font: 16px 'Source Sans', helvetica, arial, sans-serif;\n"
      + "    font-weight: 400;\n"
      + "}\n"

      + "#container {\n"
      + "    cursor: default;\n"
      + "    padding: 1px;\n"
      + "    display: flex;\n"
      + "}\n"
      
      + ".selected {\n"
      + "    background-color: #288edf;\n"
      + "    color: #ffffff;\n"
      + "}\n"

      + "#icon1, #icon2 {\n"
      + "    flex: auto 0 0;\n"
      + "    white-space: pre;\n"
      + "}\n"
      
      + "#label {\n"
      + "    flex: auto 1 1;\n"
      + "    padding-left: 0.5rem;\n"
      + "    white-space: pre;\n"
      + "}\n";
};

CbMenuItemProto._html = function() {
  return "<div id='container'>"
      +   "<div id='icon1'><i class='fa fa-fw'></i></div>"
      +   "<div id='icon2'></div>"
      +   "<div id='label'><content></content></div>"
      + "</div>";
};

CbMenuItemProto._createClone = function() {
  var template = window.document.getElementById(this._id);
  if (template === null) {
    template = window.document.createElement('template');
    template.id = this._id;
    template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
    window.document.body.appendChild(template);
  }
  return window.document.importNode(template.content, true);
};

CbMenuItemProto.createdCallback = function() {
  var icon;
  var iconhtml;
  var shadow = util.createShadowRoot(this);
//  shadow.applyAuthorStyles = true;
  
  var clone = this._createClone();
  shadow.appendChild(clone);

  iconhtml = "";
  icon = this.getAttribute('icon');
  if (icon !== null && icon !== "") {
    iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
  } else {
    iconhtml += "<i class='fa fa-fw'></i>";
  }
  shadow.querySelector("#icon2").innerHTML = iconhtml; 

  updateKeyboardSelected.call(this, this.getAttribute(SELECTED_ATTR));
};

CbMenuItemProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  if (attrName === SELECTED_ATTR ) {
    updateKeyboardSelected.call(this, newValue);
  }
};

CbMenuItemProto._clicked = function() {};

function updateKeyboardSelected(value) {
  var shadow = util.getShadowRoot(this);
  var container = shadow.querySelector("#container");
  var on = value === "true" || value === true;
  if (on) {
    container.classList.add('selected');
  } else {
    container.classList.remove('selected');
  }
}

var CbMenuItem = window.document.registerElement('cb-menuitem', {prototype: CbMenuItemProto});
return CbMenuItem;
});
