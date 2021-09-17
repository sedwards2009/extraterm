/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon } from "@nodegui/nodegui";

export interface UiStyle {
  getApplicationStyleSheet(): string;
  getButtonIcon(name: string): QIcon;
  getCommandPaletteIcon(name: string): QIcon;
  getHamburgerMenuIcon(): QIcon;
  getHamburgerMenuIconHover(): QIcon;
  getHTMLStyle(): string;
  getLinkLabelCSS(): string;
  getMenuIcon(name: string): QIcon;
  getSettingsMenuIcon(name: string): QIcon;
  getTabIcon(name: string): QIcon;
  getTrafficLightRunningColor(): string;
  getTrafficLightStoppedColor(): string;
}
