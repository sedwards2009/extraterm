define([], function() {
var ID = "CbMenuItemTemplate";

var CbMenuItemProto = Object.create(HTMLElement.prototype);;
var SELECTED_ATTR = "selected";

function createClone() {
  var template = document.getElementById(ID);
  if (template === null) {
    template = document.createElement('template');
    template.id = ID;
    template.innerHTML = "<style>\n"
      + ":host {\n"
      + "    display: block;\n"
      + "}\n"
      + "\n"
      + "#container {\n"
      + "    cursor: default;\n"
      + "    padding: 1px;\n"
      + "}\n"
      + ".selected {\n"
      + "    background-color: #288edf;\n"
      + "    color: #ffffff;\n"
      + "}\n"
      + "\n"
      + "#iconcontainer {\n"
      + "    display: inline-block;\n"
      + "    white-space: pre;\n"
      + "}\n"
      + "</style>\n"
      + "<div id='container'><div id='iconcontainer'></div><content></content></div>";
    document.body.appendChild(template);
  }
  return document.importNode(template.content, true);
}

CbMenuItemProto.createdCallback = function() {
  var icon;
  var iconhtml;
  var shadow = this.webkitCreateShadowRoot();
  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  iconhtml = "<i class='fa fa-fw'></i>";
  icon = this.getAttribute('icon');
  if (icon !== null && icon !== "") {
    iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
  } else {
    iconhtml += "<i class='fa fa-fw'></i>";
  }
  
  shadow.querySelector("#iconcontainer").innerHTML = iconhtml; 

  updateKeyboardSelected.call(this, this.getAttribute(SELECTED_ATTR));
};

CbMenuItemProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  if (attrName === SELECTED_ATTR ) {
    updateKeyboardSelected.call(this, newValue);
  }
};

CbMenuItemProto._clicked = function() {};

function updateKeyboardSelected(value) {
  var shadow = this.webkitShadowRoot;
  var container = shadow.querySelector("#container");
  var on = value === "true" || value === true;
  if (on) {
    container.classList.add('selected');
  } else {
    container.classList.remove('selected');
  }
}

var CbMenuItem = document.registerElement('cb-menuitem', {prototype: CbMenuItemProto});
return CbMenuItem;
});
