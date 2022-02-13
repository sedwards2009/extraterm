/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QMenu, QToolButton, ToolButtonPopupMode } from "@nodegui/nodegui";
import { AbstractButtonOptions, ApplyAbstractButtonOptions } from "./AbstractButton";


export interface ToolButtonOptions extends AbstractButtonOptions {
  icon?: QIcon;
  popupMode?: ToolButtonPopupMode;
  menu?: QMenu;
}

export function ToolButton(options: ToolButtonOptions): QToolButton {
  const toolButton = new QToolButton();

  ApplyAbstractButtonOptions(toolButton, options);

  const { menu, popupMode }  = options;
  if (popupMode !== undefined) {
    toolButton.setPopupMode(popupMode);
  }
  if (menu !== undefined) {
    toolButton.setMenu(menu);
  }
  return toolButton;
}
