/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, parts, render } from "extraterm-lit-html";
import { CustomElement } from "extraterm-web-component-decorators";

import {ContextMenu} from "./ContextMenu";
import { ThemeableElementBase } from "../ThemeableElementBase";
import { disassembleDOMTree } from "../DomUtils";


const SLOT_CONTEXTMENU = "et-context-menu";

/**
 * A Drop Down menu.
 *
 * The contents of a DropDown should be a ContextMenu element and another
 * element like a button which emits a click event. When the user activates
 * the button, the ContextMenu is displayed.
 */
@CustomElement("et-drop-down")
export class DropDown extends ThemeableElementBase {

  constructor() {
    super();

    this._handleClick = this._handleClick.bind(this);
    this._handleSelected = this._handleSelected.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });
    this.updateThemeCss();
    this._render();

    this._setupChildObservation();

    this.addEventListener("click", this._handleClick);
    this.addEventListener("selected", this._handleSelected);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    parts.set(this.shadowRoot, undefined);
    disassembleDOMTree(this.shadowRoot);
  }

  private _setupChildObservation(): void {
    const childChangeCallback: MutationCallback = (mutationsList, observer) => {
      for(const mutation of mutationsList) {
        if (mutation.type === "childList") {
          this._assignSlotContent();
          return;
        }
      }
    };

    const observer = new MutationObserver(childChangeCallback);
    const config = { attributes: true, childList: true, subtree: true };
    observer.observe(this, config);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._assignSlotContent();
  }

  private _handleClick(ev: MouseEvent): void {
    const cm = <ContextMenu>this.querySelector(ContextMenu.TAG_NAME);
    cm.openAround(<HTMLElement> ev.target);
  }

  private _handleSelected(ev: MouseEvent): void {
    const event = new CustomEvent("selected", { detail: ev.detail });
    this.dispatchEvent(event);
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div><slot name=${SLOT_CONTEXTMENU}></slot></div><div><slot></slot></div>`;
    render(template, this.shadowRoot);
  }

  private _assignSlotContent(): void {
    const len = this.childNodes.length;
    for (let i=0; i<len; i++) {
      const kid = this.childNodes[i];
      if (kid.nodeName === ContextMenu.TAG_NAME) {
        (<HTMLElement> kid).slot = SLOT_CONTEXTMENU;
      }
    }
  }
}
