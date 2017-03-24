/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from './DomUtils';
import {Splitter} from './gui/Splitter';
import {TabWidget} from './gui/TabWidget';
import {Tab} from './gui/Tab';
import Logger from './Logger';

interface ElementFactory {
  (): Element;
}

enum SplitterOrientation {
  VERTICAL,
  HORIZONTAL
}

interface SplitterInfoNode {
  type: "splitter";
  children: (TabWidgetInfoNode | SplitterInfoNode)[];

  splitter: Splitter;
  orientation: SplitterOrientation;
}

interface TabWidgetInfoNode {
  type: "tabwidget";
  children: TabInfo[];

  tabWidget: TabWidget;

  emptyTab: Tab;
  emptyTabContent: Element
  rightSpaceDefaultElement: Element;
}

interface TabInfo {
  tab: Tab;
  content: Element;
  container: HTMLDivElement;
}

type RootInfoNode = SplitterInfoNode | TabWidgetInfoNode;

export class SplitLayout {

  private _log: Logger = new Logger("SplitLayout");

  private _rootContainer: Element = null;

  private _tabContainerDivClass: string = null;  

  private _emptySplitFactory: ElementFactory = null;

  private _topLeftElement: Element = null;

  private _topRightElement: Element = null;

  private _rightSpaceDefaultElementFactory: ElementFactory = null;

  private _rootInfoNode: RootInfoNode = null;

  constructor() {
    const tabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
    tabWidget.setShowFrame(false);
    this._rootInfoNode = {type: "tabwidget", children: [], tabWidget: tabWidget, emptyTab: null, emptyTabContent: null, rightSpaceDefaultElement: null};
  }

  setRootContainer(el: Element): void {
    this._rootContainer = el;
  }

  getRootContainer(): Element {
    return this._rootContainer;
  }

  setTabContainerDivClass(clazz: string): void {
    this._tabContainerDivClass = clazz;
  }

  getTabContainerDivClass(): string {
    return this._tabContainerDivClass;
  }

  // Set the factory function to use when creating content to fill the situation where there are not tabs.
  setEmptySplitElementFactory(factory: ElementFactory): void {
    this._emptySplitFactory = factory;
  }

  getEmptySplitElementFactory(): ElementFactory {
    return this._emptySplitFactory;
  }

  setTopLeftElement(el: Element): void {
    this._topLeftElement = el;
  }

  getTopLeftElement(): Element {
    return this._topLeftElement;
  }

  setTopRightElement(el: Element): void {
    this._topRightElement = el;
  }
  
  getTopRightElement(): Element {
    return this._topRightElement;
  }

  setRightSpaceDefaultElementFactory(el: ElementFactory): void {
    this._rightSpaceDefaultElementFactory = el;
  }

  appendTab(tabWidget: TabWidget, tab: Tab, tabContent: Element): void {
    const info = findTabWidgetInfoByTabWidget(this._rootInfoNode, tabWidget);
    if (info == null) {
      this._log.severe("Unable to find the info for TabWidget ", tabWidget);
      return;
    }

    info.children.push({tab: tab, content: tabContent, container: null});
  }

  firstTabWidget(): TabWidget {
    return firstTabWidget(this._rootInfoNode);
  }

  update(): void {
    this._update(this._rootContainer, this._rootInfoNode);
  }

  private _update(container: Element, infoNode: RootInfoNode): void {
    if (infoNode.type === "splitter") {
      // Remove the unneeded children.
      removeAllChildrenExceptOne(container, infoNode.splitter);

      if (container.children.length === 0) {
        if (infoNode.splitter  == null) {
          infoNode.splitter = <Splitter> document.createElement(Splitter.TAG_NAME);
          // FIXME set the orientation
        }
        container.appendChild(infoNode.splitter);
      }
    } else {

      // TabWidget
      removeAllChildrenExceptOne(container, infoNode.tabWidget);
      if (container.children.length === 0) {
        if (infoNode.tabWidget  == null) {
          infoNode.tabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
          infoNode.tabWidget.setShowFrame(false);
        }
        container.appendChild(infoNode.tabWidget);
      }
      this._updateTabWidget(infoNode);

    }
  }

  private _updateTabWidget(infoNode: TabWidgetInfoNode): void {
    const tabWidget = infoNode.tabWidget;

    // Figure out which current children we definitely don't need.
    const unneededChildrenSet = new Set<Element>(DomUtils.toArray(tabWidget.children));
    for (const kid of infoNode.children) {
      unneededChildrenSet.delete(kid.tab);
      unneededChildrenSet.delete(kid.container);
    }
    if (infoNode.rightSpaceDefaultElement != null) {
      unneededChildrenSet.delete(infoNode.rightSpaceDefaultElement);
    }

    for (const kid of unneededChildrenSet) {
      tabWidget.removeChild(kid);
    }

    // Build the list of desired children nodes in order.
    const targetChildrenList: Element[] = [];
    for (const kidInfo of infoNode.children) {
      targetChildrenList.push(kidInfo.tab);

      if (kidInfo.container == null) {
        kidInfo.container = <HTMLDivElement> document.createElement("DIV");
        if (this._tabContainerDivClass != null) {
          kidInfo.container.classList.add(this._tabContainerDivClass);
        }
        kidInfo.container.appendChild(kidInfo.content);
      }
      targetChildrenList.push(kidInfo.container);
    }

    // Add any special space filling element to the right of the tabs.
    if (this._rightSpaceDefaultElementFactory != null) {
      if (infoNode.rightSpaceDefaultElement == null) {
        infoNode.rightSpaceDefaultElement = this._rightSpaceDefaultElementFactory();
      }
      targetChildrenList.push(infoNode.rightSpaceDefaultElement);
    }

    // Insert the missing children and fix the order.
    for (let i=0; i < targetChildrenList.length; i++) {
      if (tabWidget.children.item(i) !== targetChildrenList[i]) {
        tabWidget.insertBefore(targetChildrenList[i], tabWidget.children.item(i));
      }
    }

    tabWidget.update();
  }
}

function findTabWidgetInfoByTabWidget(root: RootInfoNode, tabWidget: TabWidget): TabWidgetInfoNode {
  if (root.type === "splitter") {
    for (const kid of root.children) {
      const info = findTabWidgetInfoByTabWidget(kid, tabWidget);
      if (info != null) {
        return info;
      }
    }
  } else {
    if (root.tabWidget === tabWidget) {
      return root;
    }
  }
  return null;
}

function removeAllChildrenExceptOne(container: Element, chosenOne: Element): void {
  DomUtils.toArray(container.children).forEach( (kid) => {
    if (kid !== chosenOne) {
      container.removeChild(kid);
    }
  });
}

function firstTabWidget(infoNode: RootInfoNode): TabWidget {
  if (infoNode.type === "tabwidget") {
    return infoNode.tabWidget;
  } else {
    for (const kidInfo of infoNode.children) {
      const tabWidget = firstTabWidget(kidInfo);
      if (tabWidget != null) {
        return tabWidget;
      }
    }
    return null;
  }
}


