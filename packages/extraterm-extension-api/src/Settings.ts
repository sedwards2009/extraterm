/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { Style } from "./Style.js";
import { TerminalTheme } from "./TerminalTheme.js";


export interface SettingsTab {
  /**
   * Assign a QWidget to this property to set the contexts of the tab.
   */
  contentWidget: QWidget;

  readonly style: Style;
}

export type SettingsTabFactory = (extensionTab: SettingsTab) => void;

export interface Settings {

  readonly terminal: TerminalSettings;

  registerSettingsTab(name: string, factory: SettingsTabFactory): void;
}

export interface TerminalSettings {
  currentTheme: TerminalTheme;
}
