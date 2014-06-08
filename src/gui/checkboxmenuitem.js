define([], function() {
var ID = "CbCheckBoxMenuItemTemplate";

var CbCheckBoxMenuItemProto = Object.create(HTMLElement.prototype);;
var SELECTED_ATTR = "selected";
var CHECKED_ATTR = "checked";

function createClone() {
  var template = document.getElementById(ID);
  if (template === null) {
    template = document.createElement('template');
    template.id = ID;
    template.innerHTML = "<style>\n"
      + ":host {\n"
      + "    display: block;\n"
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
      + "    white-space: pre;\n"
      + "}\n"
      + "</style>\n"
      + "<div id='container'>"
      +   "<div id='icon1'></div>"
      +   "<div id='icon2'></div>"
      +   "<div id='label'><content></content></div>"
      + "</div>";
    document.body.appendChild(template);
  }
  return document.importNode(template.content, true);
}

CbCheckBoxMenuItemProto.createdCallback = function() {
  var icon;
  var iconhtml;
  var shadow;
  var checkedhtml;
  
  shadow = this.webkitCreateShadowRoot();
  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  iconhtml = "";
  icon = this.getAttribute('icon');
  if (icon !== null && icon !== "") {
    iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
  }
  shadow.querySelector("#icon2").innerHTML = iconhtml; 
  
  updateChecked.call(this, this.getAttribute(CHECKED_ATTR));
  updateKeyboardSelected.call(this, this.getAttribute(SELECTED_ATTR));
};


function htmlValueToBool(value) {
  return ! (value === null || value === undefined || value === false || value === "" || value === "false");
}

CbCheckBoxMenuItemProto._clicked = function() {
  var checked = this.getAttribute(CHECKED_ATTR);
  this.setAttribute(CHECKED_ATTR, ! htmlValueToBool(checked));
};

CbCheckBoxMenuItemProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  if (attrName === SELECTED_ATTR ) {
    updateKeyboardSelected.call(this, newValue);
  } else if (attrName === CHECKED_ATTR) {
    updateChecked.call(this, newValue);
  }
};

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

function updateChecked(checked) {
  var checkedhtml;
  var shadow = this.webkitShadowRoot;
  var container = shadow.querySelector("#container");
  console.log("checkbox menu item update checked");
  checkedhtml = "<i class='fa fa-fw fa-" + (htmlValueToBool(checked) ? "check-" : "") + "square-o'></i>";
  shadow.querySelector("#icon1").innerHTML = checkedhtml; 
  
}

var CbCheckBoxMenuItem = document.registerElement('cb-checkboxmenuitem', {prototype: CbCheckBoxMenuItemProto});
return CbCheckBoxMenuItem;
});

