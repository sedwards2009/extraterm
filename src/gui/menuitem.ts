/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import domutils = require('../domutils');
import util = require('./util');
import resourceLoader = require('../resourceloader');
import ThemeTypes = require('../theme');
import globalcss = require('./globalcss');

const ID = "CbMenuItemTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_THEME = "ID_THEME";
const ID_ICON2 = "ID_ICON2";
const ID_LABEL = "ID_LABEL";
const CLASS_SELECTED = "selected";

let registered = false;

// Theme management
const activeInstances: Set<CbMenuItem> = new Set();
let themeCss = "";

/**
 * A menu item suitable for use inside a CbContextMenu.
 */
class CbMenuItem extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-MENUITEM';
  
  static ATTR_SELECTED = 'selected';
  
  static ID_ICON1 = "ID_ICON1";

  /**
   * Initialize the CbMenuItem class and resources.
   *
   * When CbMenuItem is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(CbMenuItem.TAG_NAME, {prototype: CbMenuItem.prototype});
      registered = true;
    }
  }
  
  // Static methods from the ThemeTypes.Themeable interface.
  static getThemeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.GUI_MENUITEM];
  }

  static setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {
    themeCss = globalcss.fontAwesomeCSS() + "\n" + cssMap.get(ThemeTypes.CssFile.GUI_CONTROLS) + "\n" +
      cssMap.get(ThemeTypes.CssFile.GUI_MENUITEM);
    activeInstances.forEach( (instance) => {
      instance._setThemeCss(themeCss);
    });
    
    // Delete the template. It contains old CSS.
    const template = <HTMLTemplate>window.document.getElementById(ID);
    if (template !== null) {
      template.parentNode.removeChild(template);
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
  createdCallback(): void {
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    if (domutils.getShadowRoot(this) !== null) {
      return;
    }
    activeInstances.add(this);
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);
    this._setThemeCss(themeCss);

    let iconhtml = "";
    const icon = this.getAttribute('icon');
    if (icon !== null && icon !== "") {
      iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
    } else {
      iconhtml += "<i class='fa fa-fw'></i>";
    }
    (<HTMLElement>shadow.querySelector("#" + ID_ICON2)).innerHTML = iconhtml;
    
    this.updateKeyboardSelected(this.getAttribute(CbMenuItem.ATTR_SELECTED));
  }

  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    activeInstances.delete(this);
  }
  
  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    if (attrName === CbMenuItem.ATTR_SELECTED) {
      this.updateKeyboardSelected(newValue);
    }
  }

  private _setThemeCss(cssText: string): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    
    (<HTMLStyleElement> domutils.getShadowId(this, ID_THEME)).textContent = cssText;
  }

  //-----------------------------------------------------------------------
  private _html(): string {
    return `
      <style id='${ID_THEME}'></style>
      <div id='${ID_CONTAINER}'>
        <div id='${CbMenuItem.ID_ICON1}'><i class='fa fa-fw'></i></div>
        <div id='${ID_ICON2}'></div>
      <div id='${ID_LABEL}'><content></content></div>
      </div>`;
  }

  private _createClone(): Node {
    let template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  _clicked(): void {}
  
  private updateKeyboardSelected(value: string): void {
    const shadow = domutils.getShadowRoot(this);
    const container = <HTMLDivElement>shadow.querySelector("#" +ID_CONTAINER);
    const on = value === "true";
    if (on) {
      container.classList.add(CLASS_SELECTED);
    } else {
      container.classList.remove(CLASS_SELECTED);
    }
  }
}

export = CbMenuItem;
