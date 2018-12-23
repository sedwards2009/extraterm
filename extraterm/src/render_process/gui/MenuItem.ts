/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as DomUtils from '../DomUtils';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const ID = "EtbMenuItemTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_ICON2 = "ID_ICON2";
const ID_LABEL = "ID_LABEL";
const ID_SHORTCUT = "ID_SHORTCUT";
const CLASS_SELECTED = "selected";

/**
 * A menu item suitable for use inside a ContextMenu.
 */
@WebComponent({tag: "et-menuitem"})
export class MenuItem extends ThemeableElementBase {
  
  static TAG_NAME = "ET-MENUITEM";
  static ID_ICON1 = "ID_ICON1";

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: false });
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.installThemeCss();

    (<HTMLElement>shadow.querySelector("#" + ID_ICON2)).innerHTML = this._formatIcon(this.getAttribute("icon"));

    const shortcut = this.getAttribute("shortcut");
    if (shortcut != null && shortcut !== "") {
      (<HTMLElement>shadow.querySelector("#" + ID_SHORTCUT)).innerHTML = shortcut;
    }

    this.updateKeyboardSelected();
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

  private _html(): string {
    return trimBetweenTags(`
      <style id='${ThemeableElementBase.ID_THEME}'></style>
      <div id='${ID_CONTAINER}'>
        <div id='${MenuItem.ID_ICON1}'><i class='fa fa-fw'></i></div>
        <div id='${ID_ICON2}'></div>
        <div id='${ID_LABEL}'><slot></slot></div>
        <div id='${ID_SHORTCUT}'></div>
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

  _clicked(): void {}

  @Attribute({default: false}) public selected: boolean;

  @Observe("selected")
  private updateKeyboardSelected(): void {
    const shadow = DomUtils.getShadowRoot(this);
    const container = <HTMLDivElement>shadow.querySelector("#" +ID_CONTAINER);
    if (this.selected) {
      container.classList.add(CLASS_SELECTED);
    } else {
      container.classList.remove(CLASS_SELECTED);
    }
  }
}
