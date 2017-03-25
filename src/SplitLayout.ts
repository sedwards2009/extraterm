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
  leftSpaceDefaultElement: Element;
  rightSpaceDefaultElement: Element;
}

interface TabInfo {
  tab: Tab;
  content: Element;
  container: Element;
}

type RootInfoNode = SplitterInfoNode | TabWidgetInfoNode;

enum RelativePosition {
  TOP_LEFT,
  TOP_RIGHT,
  TOP_WIDE,
  OTHER
}

export class SplitLayout {

  private _log: Logger = new Logger("SplitLayout");

  private _rootContainer: Element = null;

  private _tabContainerFactory: ElementFactory = null;

  private _emptySplitFactory: ElementFactory = null;

  private _topLeftElement: Element = null;

  private _topRightElement: Element = null;

  private _leftSpaceDefaultElementFactory: ElementFactory = null;

  private _rightSpaceDefaultElementFactory: ElementFactory = null;

  private _rootInfoNode: RootInfoNode = null;

  constructor() {
    this._tabContainerFactory = () => document.createElement("DIV");

    const tabWidget = <TabWidget> document.createElement(TabWidget.TAG_NAME);
    tabWidget.setShowFrame(false);
    this._rootInfoNode = {type: "tabwidget", children: [], tabWidget: tabWidget, emptyTab: null,
      emptyTabContent: null, leftSpaceDefaultElement: null, rightSpaceDefaultElement: null};
  }

  setRootContainer(el: Element): void {
    this._rootContainer = el;
  }

  getRootContainer(): Element {
    return this._rootContainer;
  }

  setTabContainerFactory(factory: ElementFactory): void {
    this._tabContainerFactory = factory;
  }

  getTabContainerFactory(): ElementFactory {
    return this._tabContainerFactory;
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

  setLeftSpaceDefaultElementFactory(el: ElementFactory): void {
    this._leftSpaceDefaultElementFactory = el;
  }
  
  getLeftSpaceDefaultElementFactory(): ElementFactory {
    return this._leftSpaceDefaultElementFactory;
  }

  setRightSpaceDefaultElementFactory(el: ElementFactory): void {
    this._rightSpaceDefaultElementFactory = el;
  }

  getRightSpaceDefaultElementFactory(): ElementFactory {
    return this._rightSpaceDefaultElementFactory;
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
    this._update(this._rootContainer, this._rootInfoNode, RelativePosition.TOP_WIDE);
  }

  private _update(container: Element, infoNode: RootInfoNode, position: RelativePosition): void {
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
      this._updateTabWidget(infoNode, position);

    }
  }

  private _updateTabWidget(infoNode: TabWidgetInfoNode, position: RelativePosition): void {
    const tabWidget = infoNode.tabWidget;

    // Compute the correct thing to place on the left side.
    let leftSpaceElement = infoNode.leftSpaceDefaultElement;
    if ((position === RelativePosition.TOP_LEFT || position == RelativePosition.TOP_WIDE) && this._topLeftElement != null) {
      leftSpaceElement = this._topLeftElement;
    } else {
      if (this._leftSpaceDefaultElementFactory != null && infoNode.leftSpaceDefaultElement == null) {
        infoNode.leftSpaceDefaultElement = this._leftSpaceDefaultElementFactory();
        leftSpaceElement = infoNode.leftSpaceDefaultElement;
      }
    }

    // Compute the correct thing to place on the right side.
    let rightSpaceElement = infoNode.rightSpaceDefaultElement;
    if ((position === RelativePosition.TOP_RIGHT || position == RelativePosition.TOP_WIDE) && this._topRightElement != null) {
      rightSpaceElement = this._topRightElement;
    } else {
      if (this._rightSpaceDefaultElementFactory != null && infoNode.rightSpaceDefaultElement == null) {
        infoNode.rightSpaceDefaultElement = this._rightSpaceDefaultElementFactory();
        rightSpaceElement = infoNode.rightSpaceDefaultElement;
      }
    }

    // Figure out which current children we definitely don't need.
    const unneededChildrenSet = new Set<Element>(DomUtils.toArray(tabWidget.children));
    if (leftSpaceElement != null) {
      unneededChildrenSet.delete(leftSpaceElement);
    }
    for (const kid of infoNode.children) {
      unneededChildrenSet.delete(kid.tab);
      unneededChildrenSet.delete(kid.container);
    }
    if (rightSpaceElement != null) {
      unneededChildrenSet.delete(rightSpaceElement);
    }

    for (const kid of unneededChildrenSet) {
      tabWidget.removeChild(kid);
    }

    // Build the list of desired children nodes in order.
    const targetChildrenList: Element[] = [];
    if (leftSpaceElement != null) {
      targetChildrenList.push(leftSpaceElement);
    }
    for (const kidInfo of infoNode.children) {
      targetChildrenList.push(kidInfo.tab);

      if (kidInfo.container == null) {
        kidInfo.container = this._tabContainerFactory()
        kidInfo.container.appendChild(kidInfo.content);
      }
      targetChildrenList.push(kidInfo.container);
    }

    if (rightSpaceElement != null) {
      targetChildrenList.push(rightSpaceElement);
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


