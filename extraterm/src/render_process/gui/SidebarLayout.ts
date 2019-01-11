/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from "extraterm-web-component-decorators";
import { TemplatedElementBase } from "./TemplatedElementBase";
import { getLogger, Logger } from "extraterm-logging";
import { CssFile } from "../../theme/Theme";
import { trimBetweenTags } from "extraterm-trim-between-tags";


const ID_TOP = "ID_TOP";
const ID_CENTER_COLUMN = "ID_CENTER_COLUMN";
const ID_CENTER_CONTAINER = "ID_CENTER_CONTAINER";
const ID_NORTH_CONTAINER = "ID_NORTH_CONTAINER";
const ID_SOUTH_CONTAINER = "ID_SOUTH_CONTAINER";
const ID_EAST_CONTAINER = "ID_EAST_CONTAINER";
const ID_WEST_CONTAINER = "ID_WEST_CONTAINER";

export type BorderSide = "north" | "south" | "east" | "west";

@WebComponent({tag: "et-sidebar-layout"})
export class SidebarLayout extends TemplatedElementBase {
   
  static TAG_NAME = "ET-SIDEBAR-LAYOUT";
  private _log: Logger;
  
  constructor() {
    super({ delegatesFocus: true });
    this._log = getLogger(SidebarLayout.TAG_NAME, this);
  }

  protected _themeCssFiles(): CssFile[] {
    return [CssFile.GUI_SIDEBAR_LAYOUT];
  }

  protected _html(): string {
    return trimBetweenTags(`
      <div id='${ID_TOP}'>
        <div id='${ID_WEST_CONTAINER}'><slot name='west'></slot></div>
        <div id='${ID_CENTER_COLUMN}'>
          <div id='${ID_NORTH_CONTAINER}'><slot name='north'></slot></div>
          <div id='${ID_CENTER_CONTAINER}'><slot></slot></div>
          <div id='${ID_SOUTH_CONTAINER}'><slot name='south'></slot></div>
        </div>
        <div id='${ID_EAST_CONTAINER}'><slot name='east'></slot></div>
      </div>`);
  }
}
