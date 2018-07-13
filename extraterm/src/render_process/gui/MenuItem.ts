/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as DomUtils from '../DomUtils';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';

const ID = "EtbMenuItemTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_ICON2 = "ID_ICON2";
const ID_LABEL = "ID_LABEL";
const CLASS_SELECTED = "selected";

/**
 * A menu item suitable for use inside a ContextMenu.
 */
@WebComponent({tag: "et-menuitem"})
export class MenuItem extends ThemeableElementBase {
  
  static TAG_NAME = 'ET-MENUITEM';
  
  static ID_ICON1 = "ID_ICON1";

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this._createClone();
    shadow.appendChild(clone);
    this.installThemeCss();

    let iconhtml = "";
    const icon = this.getAttribute('icon');
    if (icon !== null && icon !== "") {
      iconhtml += "<i class='fa-fw " + icon + "'></i>";
    } else {
      iconhtml += "<i class='fa-fw'></i>";
    }
    (<HTMLElement>shadow.querySelector("#" + ID_ICON2)).innerHTML = iconhtml;
    
    this.updateKeyboardSelected();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_MENUITEM];
  }

  private _html(): string {
    return `
      <style id='${ThemeableElementBase.ID_THEME}'></style>
      <div id='${ID_CONTAINER}'>
        <div id='${MenuItem.ID_ICON1}'><i class='fa fa-fw'></i></div>
        <div id='${ID_ICON2}'></div>
      <div id='${ID_LABEL}'><slot></slot></div>
      </div>`;
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
