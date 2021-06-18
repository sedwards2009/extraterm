/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';


export const ID_CONTAINER = "ID_CONTAINER";

/**
 * A simple base class for elements. It setups up an empty Shadow DOM.
 */
export class ThemedContainerElementBase extends TemplatedElementBase {

  constructor() {
    super({ delegatesFocus: false });
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI];
  }
  
  protected _html(): string {
    return `<div id="${ID_CONTAINER}"></div>`;
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerNode(): HTMLDivElement {
    return <HTMLDivElement> this._elementById(ID_CONTAINER);
  }
}
