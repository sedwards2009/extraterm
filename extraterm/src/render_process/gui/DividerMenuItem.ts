/*
 * Copyright 2018-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";


/**
 * Divider line menu item for use inside a context menu.
 */
@WebComponent({tag: "et-divider-menu-item"})
export class DividerMenuItem extends ThemeableElementBase {

  constructor() {
    super();
    this.attachShadow({ mode: "open", delegatesFocus: false });
    this.updateThemeCss();
    this._render();
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div id='ID_CONTAINER'><hr></div>`;
    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.GUI_DIVIDER_MENU_ITEM];
  }
}
