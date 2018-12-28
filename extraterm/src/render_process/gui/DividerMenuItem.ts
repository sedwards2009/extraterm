/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_CONTAINER = "ID_CONTAINER";

/**
 * Divider line menu item for use inside a context menu.
 */
@WebComponent({tag: "et-divider-menu-item"})
export class DividerMenuItem extends TemplatedElementBase {

  static TAG_NAME = 'ET-DIVIDER-MENU-ITEM';
  
  constructor() {
    super({ delegatesFocus: false });
  }

  protected _html(): string {
    return `
    <div id='${ID_CONTAINER}'>
      <hr>
    </div>`;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.GUI_DIVIDER_MENU_ITEM];
  }
}
