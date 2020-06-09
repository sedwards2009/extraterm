/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render, TemplateResult } from "extraterm-lit-html";
import { classMap } from "extraterm-lit-html/directives/class-map.js";
import { unsafeHTML } from "extraterm-lit-html/directives/unsafe-html";
import { Attribute, Observe, CustomElement } from "extraterm-web-component-decorators";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";


/**
 * A menu item suitable for use inside a ContextMenu.
 */
@CustomElement("et-menu-item")
export class MenuItem extends ThemeableElementBase {

  static TAG_NAME = "ET-MENU-ITEM";

  constructor() {
    super();
    this.attachShadow({ mode: "open", delegatesFocus: false });
    this._render();
    this.updateThemeCss();
  }

  @Attribute({default: false}) selected: boolean;
  @Attribute({default: ""}) shortcut: string;
  @Attribute({default: ""}) icon: string;

  @Observe("selected", "shortcut", "icon")
  private observeAttrChange(): void {
    this._render();
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div id="ID_CONTAINER" class=${classMap({"selected": this.selected})}>
        <div id="ID_ICON1">${this._formatGutterIcon()}</div>
        <div id="ID_ICON2">${this._formatIcon()}</div>
        <div id="ID_LABEL"><slot></slot></div>
        <div id="ID_SHORTCUT">${this.shortcut}</div>
      </div>`;
    render(template, this.shadowRoot);
  }

  protected _formatGutterIcon(): TemplateResult {
    return html`<i class="fa fa-fw"></i>`;
  }

  protected _formatIcon(): TemplateResult {
    const iconName = this.icon;
    if (iconName != null && iconName.startsWith("extraicon-")) {
      return html`<span class="extraicon">${unsafeHTML("&" + iconName.substr("extraicon-".length) + ";")}</span>`;
    } else {
      if (iconName == null || iconName === "") {
        return html`<i class="fa-fw fa">&nbsp;</i>`;
      } else {
        return html`<i class=${"fa-fw " + (iconName == null ? "" : iconName)}></i>`;
      }
    }
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [
      ThemeTypes.CssFile.GENERAL_GUI,
      ThemeTypes.CssFile.FONT_AWESOME,
      ThemeTypes.CssFile.EXTRAICONS,
      ThemeTypes.CssFile.GUI_MENUITEM
    ];
  }

  _clicked(): void {}
}
