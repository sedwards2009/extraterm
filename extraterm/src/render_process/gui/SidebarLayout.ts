/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render } from "extraterm-lit-html";
import { WebComponent } from "extraterm-web-component-decorators";
import { getLogger, Logger } from "extraterm-logging";
import { CssFile } from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";


export type BorderSide = "north" | "south" | "east" | "west";

@WebComponent({tag: "et-sidebar-layout"})
export class SidebarLayout extends ThemeableElementBase {

  static TAG_NAME = "ET-SIDEBAR-LAYOUT";
  private _log: Logger;

  constructor() {
    super();
    this._log = getLogger(SidebarLayout.TAG_NAME, this);
    this._handleSlotChange = this._handleSlotChange.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });
    this.updateThemeCss();
    this._render();
  }

  private _handleSlotChange(ev: Event): void {
    const slot = <HTMLSlotElement> ev.target;
    if (slot.assignedNodes().length === 0) {
      slot.parentElement.classList.add("empty");
    } else {
      slot.parentElement.classList.remove("empty");
    }
  }

  protected _themeCssFiles(): CssFile[] {
    return [CssFile.GUI_SIDEBAR_LAYOUT];
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div id='ID_TOP'>
        <div id='ID_WEST_CONTAINER' class='empty'><slot name='west' @slotchange=${this._handleSlotChange}></slot></div>
        <div id='ID_CENTER_COLUMN'>
          <div id='ID_NORTH_CONTAINER' class='empty'><slot name='north' @slotchange=${this._handleSlotChange}></slot></div>
          <div id='ID_CENTER_CONTAINER'><slot @slotchange=${this._handleSlotChange}></slot></div>
          <div id='ID_SOUTH_CONTAINER' class='empty'><slot name='south' @slotchange=${this._handleSlotChange}></slot></div>
        </div>
        <div id='ID_EAST_CONTAINER' class='empty'><slot name='east' @slotchange=${this._handleSlotChange}></slot></div>
      </div>`;
    render(template, this.shadowRoot);
  }
}
