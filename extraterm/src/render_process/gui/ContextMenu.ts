/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { CustomElement } from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";

import * as DomUtils from "../DomUtils";
import * as ThemeTypes from "../../theme/Theme";
import { MenuItem } from "./MenuItem";
import { CheckboxMenuItem } from "./CheckboxMenuItem";
import * as Util from "./Util";
import { Logger, getLogger } from "extraterm-logging";
import { findFixedPositionOffset } from "../DomUtils";
import { ThemeableElementBase } from "../ThemeableElementBase";


const ID_COVER = "ID_COVER";
const ID_CONTAINER = "ID_CONTAINER";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";
const CLASS_CONTAINER_CLOSED = "CLASS_CONTAINER_CLOSED";
const CLASS_CONTAINER_OPEN = "CLASS_CONTAINER_OPEN";


/**
 * A context menu.
 */
@CustomElement("et-context-menu")
export class ContextMenu extends ThemeableElementBase {

  static TAG_NAME = "ET-CONTEXT-MENU";

  private _log: Logger;
  private _open = false;

  constructor() {
    super();
    this._log = getLogger(ContextMenu.TAG_NAME, this);

    this._handleCoverMousedown = this._handleCoverMousedown.bind(this);
    this._handleCoverContextmenu = this._handleCoverContextmenu.bind(this);
    this._handleContainerMousedown = this._handleContainerMousedown.bind(this);
    this._handleContainerMousemove = this._handleContainerMousemove.bind(this);
    this._handleContainerMouseleave = this._handleContainerMouseleave.bind(this);
    this._handleContainerClick = this._handleContainerClick.bind(this);
    this._handleContainerKeyDown = this._handleContainerKeyDown.bind(this);
    this._handleContainerKeyPress = this._handleContainerKeyPress.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });

    this._render();
  }

  private _handleCoverMousedown(ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    if (ev.button === 0) {
      this._dismiss();
    }
  }

  private _handleCoverContextmenu(ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    this._moveContainerTo(ev.clientX, ev.clientY);
  }

  private _handleContainerMousedown(ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
  }

  private _handleContainerMousemove(ev: MouseEvent): void {
    const srcElement = <HTMLElement> ev.srcElement;
    if (srcElement.nodeName === MenuItem.TAG_NAME || srcElement.nodeName === CheckboxMenuItem.TAG_NAME) {
      this._selectMenuItem(this.childNodes, srcElement);
    } else {
      this._selectMenuItem(this.childNodes, null);
    }
  }

  private _handleContainerMouseleave(ev: MouseEvent): void {
    this._selectMenuItem(this.childNodes, null);
  }

  private _handleContainerClick(ev: MouseEvent): void {
    if (ev.srcElement instanceof MenuItem) {
      const item = <MenuItem>ev.srcElement;
      this.activateItem(item);
    }
  }

  protected _render(): void {
    const handleCoverContextmenu = {
      handlEvent: this._handleCoverContextmenu,
      capture: true,
    };

    const template = html`${this._styleTag()}
      <div
        id=${ID_COVER}
        class=${this._open ? CLASS_COVER_OPEN : CLASS_COVER_CLOSED}
        @contextmenu=${handleCoverContextmenu}
        @mousedown=${this._handleCoverMousedown}
      ></div>
      <div
        id=${ID_CONTAINER}
        class=${this._open ? CLASS_CONTAINER_OPEN : CLASS_CONTAINER_CLOSED}
        tabindex="0"
        @mousedown=${this._handleContainerMousedown}
        @mousemove=${this._handleContainerMousemove}
        @mouseleave=${this._handleContainerMouseleave}
        @click=${this._handleContainerClick}

        @keydown=${this._handleContainerKeyDown}
        @keypress=${this._handleContainerKeyPress}

      ><slot></slot></div>`;

    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTEXTMENU];
  }

  private _fetchMenuItems(kids: NodeList): MenuItem[] {
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

  private _selectMenuItem(kids: NodeList, selectitem: Element) {
    const len = kids.length;
    for (let i=0; i<len; i++) {
      const item = kids[i];

      if (item instanceof MenuItem) {
        if (selectitem === item) {
          (<MenuItem>item).setAttribute("selected", "selected");
        } else {
          (<MenuItem>item).removeAttribute("selected");
        }
      }
    }
  }

  private _handleContainerKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this._dismiss();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "Enter") {
      const menuitems = this._fetchMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => item.hasAttribute("selected"));

      if (ev.key === "ArrowUp") {
        if (keyboardselected.length === 0) {
          this._selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]);
          i = i === 0 ? menuitems.length-1 : i-1;
          this._selectMenuItem(this.childNodes, menuitems[i]);
        }
      } else if (ev.key === "ArrowDown") {
        if (keyboardselected.length === 0) {
          this._selectMenuItem(this.childNodes, menuitems[0]);
        } else {
          let i = menuitems.indexOf(keyboardselected[0]) + 1;
          if (i === menuitems.length) {
            i = 0;
          }
          this._selectMenuItem(this.childNodes, menuitems[i]);
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

    const id = item.getAttribute("id");
    const name = item.getAttribute("name");
    const checked = item.getAttribute("checked");
    this.close();

    const event = new CustomEvent("selected", { detail: { id, name, checked, menuItem: item } });
    this.dispatchEvent(event);
  }

  private _handleContainerKeyPress(ev: KeyboardEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    if (ev.key === "Enter") {
      const menuitems = this._fetchMenuItems(this.childNodes);
      if (menuitems.length === 0) {
        return;
      }

      const keyboardselected = menuitems.filter( (item:MenuItem) => item.hasAttribute("selected"));
      if (keyboardselected.length !== 0) {
        this.activateItem(keyboardselected[0]);
      }
    }
  }

  open(x: number, y: number): void {
    // Nuke any style like "display: none" which can be use to prevent flicker.
    this.setAttribute("style", "");

    this._open = true;
    this._render();

    this._moveContainerTo(x, y);
    this._selectMenuItem(this.childNodes, null);

    const container = <HTMLDivElement> this._elementById(ID_CONTAINER);
    container.focus();
  }

  private _moveContainerTo(x: number, y: number): void {
    const container = <HTMLDivElement> this._elementById(ID_CONTAINER);
    const rect = container.getBoundingClientRect();

    const coverElement = <HTMLDivElement>this._elementById(ID_COVER);
    const coverRect = coverElement.getBoundingClientRect();

    let sx = x;
    if (sx+rect.width > coverRect.right) {
      sx = coverRect.right - rect.width;
    }

    let sy = y;
    if (sy+rect.height > coverRect.bottom) {
      sy = coverRect.bottom - rect.height;
    }

    container.style.left = "" + sx + "px";
    container.style.top = "" + sy + "px";
  }

  private debugScroll(msg?: string) {
    const text = msg !== undefined ? msg : "";
    const termdiv = window.document.querySelector("div.terminal");
    console.log(text + " -- termdiv.scrollTop: " + termdiv.scrollTop);

    const active = window.document.activeElement;
    console.log("active element: " + active);
    if (active !== null) {
      console.log("active element nodeName: " + active.nodeName);
      console.log("active element class: " + active.getAttribute("class"));
    }
  }

  openAround(targetElement: HTMLElement) {
    // Nuke any style like "display: none" which can be use to prevent flicker.
    this.setAttribute("style", "");

    this._open = true;
    this._render();

    const targetElementRect = targetElement.getBoundingClientRect();

    const container = <HTMLDivElement>this._elementById(ID_CONTAINER);
    const containerRect = container.getBoundingClientRect();

    const coverElement = <HTMLDivElement>this._elementById(ID_COVER);
    const coverRect = coverElement.getBoundingClientRect();

    let containerX = targetElementRect.left;
    if (containerX + containerRect.width > coverRect.right) {
      containerX = coverRect.right - containerRect.width;
    }

    let containerY = targetElementRect.bottom;
    if (containerY+containerRect.height > coverRect.bottom) {
      containerY = targetElementRect.top - containerRect.height;
    }

    const offset = findFixedPositionOffset(container);
    containerX -= offset.left;
    containerY -= offset.top;

    container.style.left = "" + containerX + "px";
    container.style.top = "" + containerY + "px";

    this._selectMenuItem(this.childNodes, null);
    container.focus();
  }

  private _dismiss(): void {
    this.close();
    const event = new CustomEvent("dismissed", { });
    this.dispatchEvent(event);
  }

  close(): void {
    this._open = false;
    this._render();
  }

  private _elementById(id: string): HTMLElement {
    return DomUtils.getShadowId(this, id);
  }
}
