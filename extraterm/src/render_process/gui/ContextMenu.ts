/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import {MenuItem} from './MenuItem';
import {CheckboxMenuItem} from './CheckboxMenuItem';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';
import {Logger, getLogger} from "extraterm-logging";


const ID = "EtContextMenuTemplate";
const ID_COVER = "ID_COVER";
const ID_CONTAINER = "ID_CONTAINER";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";
const CLASS_CONTAINER_CLOSED = "CLASS_CONTAINER_CLOSED";
const CLASS_CONTAINER_OPEN = "CLASS_CONTAINER_OPEN";

/**
 * A context menu.
 */
@WebComponent({tag: "et-contextmenu"})
export class ContextMenu extends ThemeableElementBase {
   
  static TAG_NAME = "ET-CONTEXTMENU";
  
  private _log: Logger;
  
  constructor() {
    super();
    this._log = getLogger(ContextMenu.TAG_NAME, this);
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.installThemeCss();

    const cover = <HTMLDivElement>DomUtils.getShadowId(this, ID_COVER);
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
    
    const container = <HTMLDivElement>DomUtils.getShadowId(this, ID_CONTAINER);
    container.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    });
    
    container.addEventListener('mousemove', (ev: MouseEvent) => {
      if (ev.srcElement.nodeName === MenuItem.TAG_NAME || ev.srcElement.nodeName === CheckboxMenuItem.TAG_NAME) {
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

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTEXTMENU];
  }

  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
          <div id='${ID_COVER}' class='${CLASS_COVER_CLOSED}'></div>
          <div id='${ID_CONTAINER}' class='${CLASS_CONTAINER_CLOSED}' tabindex='0'><slot></slot></div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private fetchMenuItems(kids: NodeList): MenuItem[] {
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

  private selectMenuItem(kids: NodeList, selectitem: Element) {
    const len = kids.length;
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if (item instanceof MenuItem) {
        (<MenuItem>item).setAttribute('selected', selectitem === item ? "true" : "false");
      }
    }
  }

  private handleKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this.close();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "Enter") {
      const menuitems = this.fetchMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => Util.htmlValueToBool(item.getAttribute("selected")));

      if (ev.key === "ArrowUp") {
        if (keyboardselected.length === 0) {
          this.selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]);
          i = i === 0 ? menuitems.length-1 : i-1;
          this.selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else if (ev.key === "ArrowDown") {
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

  private activateItem(item: MenuItem): void {
    item._clicked();

    const name = item.getAttribute('name');
    const checked = item.getAttribute('checked');
    this.close();

    const event = new CustomEvent('selected', { detail: {name: name, checked: checked } });
    this.dispatchEvent(event);
  }

  private handleKeyPress(ev: KeyboardEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.key === "Enter") {
      const menuitems = this.fetchMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => Util.htmlValueToBool(item.getAttribute("selected")) );
      if (keyboardselected.length !== 0) {
        this.activateItem(keyboardselected[0]);
      }
    }  
  }

  open(x: number, y: number): void {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const container = <HTMLDivElement>DomUtils.getShadowId(this, ID_CONTAINER);
    container.classList.remove(CLASS_CONTAINER_CLOSED);
    container.classList.add(CLASS_CONTAINER_OPEN);

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

    this._openCover();
    this.selectMenuItem(this.childNodes, null);

    container.focus();
  }

  private _openCover(): void {
    const cover = <HTMLDivElement> DomUtils.getShadowId(this, ID_COVER);
    cover.className = CLASS_COVER_OPEN;
  }

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

  openAround(targetElement: HTMLElement) {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const targetElementRect = targetElement.getBoundingClientRect();
    const container = <HTMLDivElement>DomUtils.getShadowId(this, ID_CONTAINER);
    container.classList.remove(CLASS_CONTAINER_CLOSED);
    container.classList.add(CLASS_CONTAINER_OPEN);  
    const containerRect = container.getBoundingClientRect();

    let containerX = targetElementRect.left;
    if (containerX + containerRect.width > window.innerWidth) {
      containerX = window.innerWidth - containerRect.width;
    }

    let containerY = targetElementRect.bottom;
    if (containerY+containerRect.height > window.innerHeight) {
      containerY = targetElementRect.top - containerRect.height;
    }

    container.style.left = "" + containerX + "px";
    container.style.top = "" + containerY + "px";

    this._openCover();
    this.selectMenuItem(this.childNodes, null);
    container.focus();
  }

  close(): void {
    let event = new CustomEvent('before-close', { detail: null });
    this.dispatchEvent(event);

    const cover = <HTMLDivElement>DomUtils.getShadowId(this, ID_COVER);
    cover.className = CLASS_COVER_CLOSED;

    const container = <HTMLDivElement>DomUtils.getShadowId(this, ID_CONTAINER);
    container.classList.remove(CLASS_CONTAINER_OPEN);
    container.classList.add(CLASS_CONTAINER_CLOSED);

    event = new CustomEvent('close', { detail: null });
    this.dispatchEvent(event);
  }
}
