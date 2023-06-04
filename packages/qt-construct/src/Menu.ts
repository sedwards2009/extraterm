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
  onAboutToHide?: () => void;
  onAboutToShow?: () => void;
  onHovered?: (nativeAction) => void;
  onTriggered?: (nativeAction) => void;
  items?: ActionOptions[];
}

export function Menu(options: MenuOptions): QMenu {
  const menu = new QMenu();

  ApplyWidgetOptions(menu, options);

  const { onAboutToHide, onAboutToShow, onHovered, onTriggered, items } = options;

  if (onAboutToHide !== undefined) {
    menu.addEventListener("aboutToHide", onAboutToHide);
  }
  if (onAboutToShow !== undefined) {
    menu.addEventListener("aboutToShow", onAboutToShow);
  }
  if (onHovered !== undefined) {
    menu.addEventListener("hovered", onHovered);
  }
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
