/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QTabWidget, QWidget } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";

export interface TabWidgetOptions extends WidgetOptions {
  tabs: TabWidgetTabOptions[];
}

export interface TabWidgetTabOptions {
  icon?: QIcon;
  label: string;
  page: QWidget;
}

export function TabWidget(options: TabWidgetOptions): QTabWidget {
  const tabWidget = new QTabWidget();
  const { tabs } = options;

  ApplyWidgetOptions(tabWidget, options);

  for (const tabOptions of tabs) {
    const { icon, label, page }  = tabOptions;
    tabWidget.addTab(page, icon == null ? new QIcon() : icon, label);
  }

  return tabWidget;
}
