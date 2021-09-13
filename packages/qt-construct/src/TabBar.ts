/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QTabBar } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface TabBarOptions extends WidgetOptions {
  expanding?: boolean;
  onCurrentChanged?: (index: number) => void;
  tabsClosable?: boolean;
  onTabCloseRequested?: (index: number) => void;
  tabs: TabBarTabOptions[];
}

export interface TabBarTabOptions {
  icon?: QIcon;
  label: string;
}

export function TabBar(options: TabBarOptions): QTabBar {
  const tabBar = new QTabBar();

  ApplyWidgetOptions(tabBar, options);

  const { expanding, onCurrentChanged, onTabCloseRequested, tabsClosable, tabs } = options;
  if (expanding !== undefined) {
    tabBar.setExpanding(expanding);
  }

  if (tabsClosable !== undefined) {
    tabBar.setTabsClosable(tabsClosable);
  }

  if (onCurrentChanged !== undefined) {
    tabBar.addEventListener("currentChanged", onCurrentChanged);
  }

  if (onTabCloseRequested !== undefined) {
    tabBar.addEventListener("tabCloseRequested", onTabCloseRequested);
  }

  for (const tabOptions of tabs) {
    const { icon, label }  = tabOptions;
    tabBar.addTab(icon == null ? new QIcon() : icon, label);
  }
  return tabBar;
}
