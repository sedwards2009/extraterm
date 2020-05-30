/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, TemplateResult } from "extraterm-lit-html";
import { classMap } from "extraterm-lit-html/directives/class-map.js";
import { Attribute, Observe, WebComponent } from "extraterm-web-component-decorators";

import {MenuItem} from "./MenuItem";

/**
 * A check box menu item for use inside a context menu.
 */
@WebComponent({tag: "et-checkboxmenuitem"})
export class CheckboxMenuItem extends MenuItem {

  static TAG_NAME = "ET-CHECKBOXMENUITEM";

  @Attribute({default: false}) checked: boolean;

  @Observe("checked")
  private _observeChecked(): void {
    this._render();
  }

  protected _formatGutterIcon(): TemplateResult {
    const classes = {
      "fa-fw": true,
      "far": true,
      "fa-check-square": this.checked,
      "fa-square": ! this.checked
    };
    return html`<i class=${classMap(classes)}></i>`;
  }

  _clicked(): void {
    this.checked = ! this.checked;
  }
}
