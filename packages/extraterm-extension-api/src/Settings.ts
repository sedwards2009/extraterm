/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";


export interface SettingsTab {
  /**
   * Assign a QWidget to this property to set the contexts of the tab.
   */
  contentWidget: QWidget;
}
