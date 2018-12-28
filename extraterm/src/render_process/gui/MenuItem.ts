/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_CONTAINER = "ID_CONTAINER";
const ID_ICON2 = "ID_ICON2";
const ID_LABEL = "ID_LABEL";
const ID_SHORTCUT = "ID_SHORTCUT";
const CLASS_SELECTED = "selected";

/**
 * A menu item suitable for use inside a ContextMenu.
 */
@WebComponent({tag: "et-menuitem"})
export class MenuItem extends TemplatedElementBase {
  
  static TAG_NAME = "ET-MENUITEM";
  static ID_ICON1 = "ID_ICON1";

  constructor() {
    super({ delegatesFocus: false });

    (<HTMLElement>this._elementById(ID_ICON2)).innerHTML = this._formatIcon(this.getAttribute("icon"));

    const shortcut = this.getAttribute("shortcut");
    if (shortcut != null && shortcut !== "") {
      (<HTMLElement>this._elementById(ID_SHORTCUT)).innerHTML = shortcut;
    }

    this.updateKeyboardSelected();
  }

  protected _html(): string {
    return `
      <div id='${ID_CONTAINER}'>
        <div id='${MenuItem.ID_ICON1}'><i class='fa fa-fw'></i></div>
        <div id='${ID_ICON2}'></div>
        <div id='${ID_LABEL}'><slot></slot></div>
        <div id='${ID_SHORTCUT}'></div>
      </div>`;
  }

  protected _formatIcon(iconName?: string): string {
    if (iconName != null && iconName.startsWith('extraicon-')) {
      return `<span class='extraicon'>&${iconName.substr('extraicon-'.length)};</span>`;
    } else {
      if (iconName == null) {
        return `<i class='fa-fw fa'>&nbsp;</i>`;
      } else {
        return `<i class='fa-fw ${iconName != null ? iconName : ""}'></i>`;
      }
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME,
      ThemeTypes.CssFile.EXTRAICONS, ThemeTypes.CssFile.GUI_MENUITEM];
  }

  _clicked(): void {}

  @Attribute({default: false}) public selected: boolean;

  @Observe("selected")
  private updateKeyboardSelected(): void {
    const container = <HTMLDivElement> this._elementById(ID_CONTAINER);
    if (this.selected) {
      container.classList.add(CLASS_SELECTED);
    } else {
      container.classList.remove(CLASS_SELECTED);
    }
  }
}
