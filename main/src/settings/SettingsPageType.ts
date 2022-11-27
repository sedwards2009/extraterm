/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";


export interface SettingsPageType {
  getIconName(): string;
  getMenuText(): string;
  getPage(): QWidget;
}
