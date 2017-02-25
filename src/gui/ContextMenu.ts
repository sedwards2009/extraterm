/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import {CbMenuItem as MenuItem} from './MenuItem';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';

MenuItem.init();

const ID = "CbContextMenuTemplate";
const ID_COVER = "ID_COVER";
const ID_CONTAINER = "ID_CONTAINER";

let registered = false;

/**
 * A context menu.
 */
export class CbContextMenu extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "CB-CONTEXTMENU";

  /**
   * Initialize the CbContextMenu class and resources.
   *
   * When CbContextMenu is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbContextMenu.TAG_NAME, {prototype: CbContextMenu.prototype});
      registered = true;
    }
  }
  
  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id='${ID_COVER}' class='cover_closed'></div>
        <div id='${ID_CONTAINER}' class='container_closed' tabindex='0'><slot></slot></div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private __getById(id:string): Element {
    return DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTEXTMENU];
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
  createdCallback() {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();

    const cover = <HTMLDivElement>this.__getById(ID_COVER);
    cover.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (ev.button === 0) {
        this.close();
      }
    });
    
    cover.addEventListener('contextmenu', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.close();
    }, true);
    
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    container.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    });
    
    container.addEventListener('mousemove', (ev: MouseEvent) => {
      if (ev.srcElement.nodeName === 'CB-MENUITEM' || ev.srcElement.nodeName === 'CB-CHECKBOXMENUITEM') {
        this.selectMenuItem(this.childNodes, ev.srcElement);
      } else {
        this.selectMenuItem(this.childNodes, null);
      }
    });
    
    container.addEventListener('mouseleave', (ev: MouseEvent) => {
      this.selectMenuItem(this.childNodes, null);
    });
    
    container.addEventListener('click', (ev: MouseEvent) => {
      if (ev.srcElement instanceof MenuItem) {
        const item = <MenuItem>ev.srcElement;
        this.activateItem(item);
      }
    });
    
    container.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    container.addEventListener('keypress', (ev: KeyboardEvent) => { this.handleKeyPress(ev); });
  }

  //-----------------------------------------------------------------------

  /**
   * 
   */
  private fetchCbMenuItems(kids: NodeList): MenuItem[] {
    const len = kids.length;
    const result: MenuItem[] = [];
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if(item instanceof MenuItem) {
        result.push(<MenuItem>item);
      }
    }
    return result;
  }

  /**
   * 
   */
  private selectMenuItem(kids: NodeList, selectitem: Element) {
    const len = kids.length;
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if (item instanceof MenuItem) {
        (<MenuItem>item).setAttribute('selected', selectitem === item ? "true" : "false");
      }
    }
  }

  /**
   * 
   */
  private handleKeyDown(ev: KeyboardEvent) {
    // Escape.
    if (ev.keyIdentifier === "U+001B") {
      this.close();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.keyIdentifier === "Up" || ev.keyIdentifier === "Down" || ev.keyIdentifier === "Enter") {
      const menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => Util.htmlValueToBool(item.getAttribute("selected")));

      if (ev.keyIdentifier === "Up") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]);
          i = i === 0 ? menuitems.length-1 : i-1;
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else if (ev.keyIdentifier === "Down") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[0]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]) + 1;
          if (i === menuitems.length) {
            i = 0;
          }
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else {
        // Enter
        ev.stopPropagation();
        return;
      }
    }
    ev.preventDefault();
    ev.stopPropagation();
  }

  /**
   * 
   */
  private activateItem(item: MenuItem): void {
    item._clicked();

    const name = item.getAttribute('name');
    const checked = item.getAttribute('checked');
    this.close();

    const event = new CustomEvent('selected', { detail: {name: name, checked: checked } });
    this.dispatchEvent(event);
  }

  /**
   * 
   */
  private handleKeyPress(ev: KeyboardEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.keyIdentifier === "Enter") {
      const menuitems = this.fetchCbMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => Util.htmlValueToBool(item.getAttribute("selected")) );
      if (keyboardselected.length !== 0) {
        this.activateItem(keyboardselected[0]);
      }
    }  
  }

  /**
   * 
   */
  open(x: number, y: number): void {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    container.classList.remove('container_closed');
    container.classList.add('container_open');  

    const rect = container.getBoundingClientRect();

    var sx = x;
    if (sx+rect.width > window.innerWidth) {
      sx = window.innerWidth - rect.width;
    }

    var sy = y;
    if (sy+rect.height > window.innerHeight) {
      sy = window.innerHeight - rect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    const cover = <HTMLDivElement>this.__getById(ID_COVER);
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  /**
   * 
   */
  private debugScroll(msg?: string) {
    const text = msg !== undefined ? msg : "";
    const termdiv = window.document.querySelector('div.terminal');
    console.log(text + " -- termdiv.scrollTop: " + termdiv.scrollTop);

    const active = window.document.activeElement;
    console.log("active element: " + active);
    if (active !== null) {
      console.log("active element nodeName: " + active.nodeName);
      console.log("active element class: " + active.getAttribute('class'));
    }
  }

  /**
   * 
   */
  openAround(el: HTMLElement) {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const elrect = el.getBoundingClientRect();

    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    container.classList.remove('container_closed');  
    container.classList.add('container_open');  
    const containerrect = container.getBoundingClientRect();

    let sx = elrect.left;
    if (sx+containerrect.width > window.innerWidth) {
      sx = window.innerWidth - containerrect.width;
    }

    let sy = elrect.bottom;
    if (sy+containerrect.height > window.innerHeight) {
      sy = elrect.top - containerrect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";

    const cover = <HTMLDivElement>this.__getById(ID_COVER);
    cover.className = "cover_open";

    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  /**
   * 
   */
  close(): void {
    let event = new CustomEvent('before-close', { detail: null });
    this.dispatchEvent(event);

    const cover = <HTMLDivElement>this.__getById(ID_COVER);
    cover.className = "cover_closed";

    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    container.classList.remove('container_open');  
    container.classList.add('container_closed');

    event = new CustomEvent('close', { detail: null });
    this.dispatchEvent(event);
  }
}
