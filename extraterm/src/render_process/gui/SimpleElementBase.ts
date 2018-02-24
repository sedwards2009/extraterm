/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';


export const ID_CONTAINER = "ID_CONTAINER";

/**
 * A simple base class for elements. It setups up an empty Shadow DOM.
 */
export class SimpleElementBase extends ThemeableElementBase {

  constructor() {
    super();
    this._setupDOM();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS];
  }

  private _containerDivElement: HTMLDivElement = null;

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    const styleElement = document.createElement("style");
    styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(styleElement);

    this._containerDivElement = document.createElement("div");
    this._containerDivElement.id = ID_CONTAINER;
    this.shadowRoot.appendChild(this._containerDivElement);

    this.updateThemeCss();
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerNode(): HTMLDivElement {
    return this._containerDivElement;
  }
}
