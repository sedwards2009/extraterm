/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon } from "@nodegui/nodegui";

export interface UiStyle {
  getApplicationStyleSheet(): string;
  getHamburgerMenuIcon(): QIcon;
  getHamburgerMenuIconHover(): QIcon;
  getMenuIcon(name: string): QIcon;
}
