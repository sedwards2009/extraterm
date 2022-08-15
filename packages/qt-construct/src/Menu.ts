/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QMenu, QShortcut, QVariant } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";


export interface ActionOptions {
  title: string;
  icon?: QIcon;
  shortcut?: QShortcut;
  data?: QVariant | string;
}

export interface MenuOptions extends WidgetOptions {
  onTriggered?: (nativeAction) => void;
  items?: ActionOptions[];
}

export function Menu(options: MenuOptions): QMenu {
  const menu = new QMenu();

  ApplyWidgetOptions(menu, options);

  const { onTriggered, items } = options;
  if (onTriggered !== undefined) {
    menu.addEventListener("triggered", onTriggered);
  }

  if (items !== undefined) {
    for (const item of items) {
      const action = menu.addAction(item.title);
      if (item.icon !== undefined) {
        action.setIcon(item.icon);
      }
      if (item.data !== undefined) {
        if (item.data instanceof QVariant) {
          action.setData(item.data);
        } else {
          action.setData(new QVariant(item.data));
        }
      }
    }
  }

  return menu;
}
