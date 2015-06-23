import util = require('./util');
import resourceLoader = require('../resourceloader');

const ID = "CbMenuItemTemplate";

const SELECTED_ATTR = "selected";
let registered = false;

class CbMenuItem extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics

  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-menuitem', {prototype: CbMenuItem.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  createdCallback(): void {
    const shadow = util.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);

    let iconhtml = "";
    const icon = this.getAttribute('icon');
    if (icon !== null && icon !== "") {
      iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
    } else {
      iconhtml += "<i class='fa fa-fw'></i>";
    }
    (<HTMLElement>shadow.querySelector("#icon2")).innerHTML = iconhtml; 

    this.updateKeyboardSelected(this.getAttribute(SELECTED_ATTR));
  }
  
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    if (attrName === SELECTED_ATTR ) {
      this.updateKeyboardSelected(newValue);
    }
  }
  
  //-----------------------------------------------------------------------
  private _css(): string {
    return "@import url('" + resourceLoader.toUrl("css/font-awesome.css") + "');\n" +
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

  private _html(): string {
    return "<div id='container'>" +
      "<div id='icon1'><i class='fa fa-fw'></i></div>" +
      "<div id='icon2'></div>" +
      "<div id='label'><content></content></div>" +
      "</div>";
  }

  private _createClone(): Node {
    let template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  _clicked(): void {}
  
  private updateKeyboardSelected(value: string): void {
    const shadow = util.getShadowRoot(this);
    const container = <HTMLDivElement>shadow.querySelector("#container");
    const on = value === "true";
    if (on) {
      container.classList.add('selected');
    } else {
      container.classList.remove('selected');
    }
  }
}

export = CbMenuItem;
