/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QMenu } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";


export interface MenuOptions extends WidgetOptions {
  onTriggered?: (nativeAction) => void;
}

export function Menu(options: MenuOptions): QMenu {
  const menu = new QMenu();

  ApplyWidgetOptions(menu, options);

  const { onTriggered } = options;
  if (onTriggered !== undefined) {
    menu.addEventListener("triggered", onTriggered);
  }
  return menu;
}
