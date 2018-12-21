/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';

import * as DomUtils from '../DomUtils';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const ID_CONTAINER = "ID_CONTAINER";
const ID = "EtDividerMenuItemTemplate";


/**
 * Divider line menu item for use inside a context menu.
 */
@WebComponent({tag: "et-divider-menu-item"})
export class DividerMenuItem extends ThemeableElementBase {

  static TAG_NAME = 'ET-DIVIDER-MENU-ITEM';
  
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: false });
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.installThemeCss();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI]; //, ThemeTypes.CssFile.GUI_DIVIDER_MENU_ITEM];
  }

  private _html(): string {
    return trimBetweenTags(`
      <style id='${ThemeableElementBase.ID_THEME}'></style>
      <div id='${ID_CONTAINER}'>
        <hr>
      </div>`);
  }

  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }
}
