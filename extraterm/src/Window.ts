/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QStackedWidget, QTabBar, QWidget, QBoxLayout } from "@nodegui/nodegui";
import { Tab } from "./Tab";
import { Terminal } from "./terminal/Terminal";


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

    this.#tabs.push(new Terminal());

    this.#updateTabBar(this.#tabs);
    this.#updateContentStack(this.#tabs);
  }

  #createTabBar(): QTabBar {
    const tabbarContainer = new QWidget();
    const tabbarContainerLayout = new QBoxLayout(Direction.LeftToRight, tabbarContainer);
    const tabBar = new QTabBar();
    tabbarContainerLayout.addWidget(tabBar);

    return tabBar;
  }

  #updateTabBar(tabs: Tab[]): void {
    for (const tab of tabs) {
      const header = tab.getTitle();
      this.#tabBar.addTab(null, header);
    }
  }

  #updateContentStack(tabs: Tab[]): void {
    for (const tab of tabs) {
      this.#contentStack.addWidget(tab.getContents());
    }
  }

  open(): void {
    this.#windowWidget.show();
  }
}
