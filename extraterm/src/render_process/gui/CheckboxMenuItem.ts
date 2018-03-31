/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as DomUtils from '../DomUtils';
import {MenuItem} from './MenuItem';
import * as Util from './Util';

const ID = "EtCheckboxMenuItemTemplate";


/**
 * A check box menu item for use inside a context menu.
 */
@WebComponent({tag: "et-checkboxmenuitem"})
export class CheckboxMenuItem extends MenuItem {
  
  static TAG_NAME = 'ET-CHECKBOXMENUITEM';
  
  connectedCallback(): void {
    super.connectedCallback();
    this._updateChecked();
  }

  @Attribute({default: false}) public checked: boolean;

  @Observe("checked")
  private _updateChecked(): void {
    const shadow = DomUtils.getShadowRoot(this);
    const checkedhtml = "<i class='fa-fw " + (this.checked ? "far fa-check-square" : "far fa-square") + " '></i>";
    (<HTMLDivElement>shadow.querySelector("#" + MenuItem.ID_ICON1)).innerHTML = checkedhtml; 
  }

  _clicked(): void {
    this.checked = ! this.checked;
  }
}
