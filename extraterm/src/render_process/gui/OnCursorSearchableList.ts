/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { CustomElement } from "extraterm-web-component-decorators";
import { SearchableList } from "./SearchableList";
import * as ThemeTypes from "../../theme/Theme";


@CustomElement("et-on-cursor-searchable-list")
export class OnCursorSearchableList<T extends { id: string; }> extends SearchableList<T> {

  static TAG_NAME = "ET-ON-CURSOR-SEARCHABLE-LIST";

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const cssFiles = super._themeCssFiles();
    return [...cssFiles, ThemeTypes.CssFile.GUI_ON_CURSOR_SEARCHABLE_LIST];
  }
}
