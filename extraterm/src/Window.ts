/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QStackedWidget, QTabBar, QWidget, QBoxLayout } from "@nodegui/nodegui";
import { Tab } from "./Tab";


export class Window {

  #windowWidget: QWidget = null;
  #tabBar: QTabBar = null;
  #contentStack: QStackedWidget = null;

  #tabs: Tab[] = [];

  constructor() {
    this.#windowWidget = new QWidget();
    this.#windowWidget.setWindowTitle("Extraterm Qt");

    const topLayout = new QBoxLayout(Direction.TopToBottom, this.#windowWidget);

    this.#tabBar = this.#createTabBar();

    topLayout.addWidget(this.#tabBar);

    this.#contentStack = new QStackedWidget();
    topLayout.addWidget(this.#contentStack);
  }

  #createTabBar(): QTabBar {
    const tabbarContainer = new QWidget();
    const tabbarContainerLayout = new QBoxLayout(Direction.LeftToRight, tabbarContainer);
    const tabBar = new QTabBar();
    tabbarContainerLayout.addWidget(tabBar);

    return tabBar;
  }

  open(): void {
    this.#windowWidget.show();
  }

  addTab(tab: Tab): void {
    this.#tabs.push(tab);

    const header = tab.getTitle();
    this.#tabBar.addTab(null, header);

    this.#contentStack.addWidget(tab.getContents());
  }
}
