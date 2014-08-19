///<reference path='../chrome_lib.d.ts'/>
///<reference path='../requirejs.d.ts'/>
import util = require('./util');

var SELECTED_ATTR = "selected";

class CbMenuItem extends HTMLElement {
  
  private _id = "CbMenuItemTemplate";
  
  private _css() {
    return "@import url('" + requirejs.toUrl("css/font-awesome.css") + "');\n" +
      ":host {\n" +
      "    display: block;\n" +
      "    color: #000;\n" +
      "    font: 16px 'Source Sans', helvetica, arial, sans-serif;\n" +
      "    font-weight: 400;\n" +
      "}\n" +

      "#container {\n" +
      "    cursor: default;\n" +
      "    padding: 1px;\n" +
      "    display: flex;\n" +
      "}\n" +

      ".selected {\n" +
      "    background-color: #288edf;\n" +
      "    color: #ffffff;\n" +
      "}\n" +

      "#icon1, #icon2 {\n" +
      "    flex: auto 0 0;\n" +
      "    white-space: pre;\n" +
      "}\n" +

      "#label {\n" +
      "    flex: auto 1 1;\n" +
      "    padding-left: 0.5rem;\n" +
      "    white-space: pre;\n" +
      "}\n";
  }

  private _html() {
    return "<div id='container'>" +
      "<div id='icon1'><i class='fa fa-fw'></i></div>" +
      "<div id='icon2'></div>" +
      "<div id='label'><content></content></div>" +
      "</div>";
  }
  
  private _createClone() {
    var template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(this._id);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = this._id;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  createdCallback() {
    var icon: string;
    var iconhtml: string;
    var shadow = util.createShadowRoot(this);
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

    this.updateKeyboardSelected(this.getAttribute(SELECTED_ATTR));
  }

  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    if (attrName === SELECTED_ATTR ) {
      this.updateKeyboardSelected(newValue);
    }
  }

  _clicked() {}
  
  private updateKeyboardSelected(value: string) {
    var shadow = util.getShadowRoot(this);
    var container = shadow.querySelector("#container");
    var on = value === "true";
    if (on) {
      container.classList.add('selected');
    } else {
      container.classList.remove('selected');
    }
  }
}

window.document.registerElement('cb-menuitem', {prototype: CbMenuItem.prototype});
export = CbMenuItem;
