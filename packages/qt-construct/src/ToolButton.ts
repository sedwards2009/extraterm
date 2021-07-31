/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QMenu, QToolButton, ToolButtonPopupMode } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";


export interface ToolButtonOptions extends WidgetOptions {
  icon?: QIcon;
  popupMode?: ToolButtonPopupMode;
  text?: string;
  onClicked?: () => void;
  menu?: QMenu;
}

export function ToolButton(options: ToolButtonOptions): QToolButton {
  const toolButton = new QToolButton();

  ApplyWidgetOptions(toolButton, options);
  const { text, icon, onClicked, menu, popupMode }  = options;

  if (text !== undefined) {
    toolButton.setText(text);
  }
  if (onClicked !== undefined) {
    toolButton.addEventListener("clicked", onClicked);
  }
  if (icon !== undefined) {
    toolButton.setIcon(icon);
  }
  if (popupMode !== undefined) {
    toolButton.setPopupMode(popupMode);
  }
  if (menu !== undefined) {
    toolButton.setMenu(menu);
  }
  return toolButton;
}
