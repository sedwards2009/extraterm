/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";
jest.mock("./gui/Splitter");
jest.mock("./gui/Tab");
jest.mock("./gui/TabWidget");
import { Splitter } from "./gui/Splitter";
import { Tab } from "./gui/Tab";
import { TabWidget } from "./gui/TabWidget";

import { SplitLayout } from "./SplitLayout";

const SplitOrientation = {
  VERTICAL: 0,
  HORIZONTAL: 1
};

class FakeChildrenArray {

  _children = [];
  length = 0;

  constructor() {
    this._children = [];
    this.length = 0;
  }

  item(x) {
    return this._children[x];
  }

  push(kid) {
    this._children.push(kid);
    this.length = this._children.length;
    this._updateIndex();
  }

  _remove(kid) {
    const currentLength = this._children.length;

    this._children = this._children.filter( c => c !== kid );
    this.length = this._children.length;

    for (let i=0; i<currentLength; i++) {
      delete this[i];
    }
    this._updateIndex();
  }

  _updateIndex() {
    const currentLength = this._children.length;
    for (let i=0; i<currentLength; i++) {
      this[i] = this._children[i];
    }
  }

  _insertAt(index, item) {
    this._children.splice(index, 0, item);
    this.length = this._children.length;
    this._updateIndex();
  }
}

class FakeElement {
  name = "";
  children = new FakeChildrenArray();
  parent = null;

  constructor(name) {
    this.name = name;
    this.parent = null;
  }

  appendChild(child) {
    if (child.parent != null) {
      child.parent.children._remove(child);
    }

    this.children.push(child);
    child.parent = this;
  }

  insertBefore(child, refChild) {
    if (child.parent != null) {
      child.parent.children._remove(child);
    }

    const index = this.children._children.indexOf(refChild);
    this.children._insertAt(index, child);
    child.parent = this;
  }

  removeChild(child) {
    this.children._remove(child);
    child.parent = null;
  }

  _toFlatObject() {
    return { orientation: SplitOrientation.HORIZONTAL, name: this.name, children: this.children._children.map( c => c._toFlatObject() ) };
  }
}

let splitterCounter = 0;
class FakeSplitter extends FakeElement {
  _orientation = SplitOrientation.VERTICAL;
  _dividerSize = 4;
  _width = 100;
  _height = 200;

  constructor() {
    super("Splitter " + splitterCounter);
    splitterCounter++;
  }

  getDividerSize() {
    return this._dividerSize;
  }

  setSplitOrientation(orientation) {
    this._orientation = orientation;
  }

  getPaneSizes() {
    const equalSize = ((this._orientation === SplitOrientation.VERTICAL ? this._width : this._height)
      - (this.children.length-1) * this._dividerSize) / this.children.length;

    const result = [];
    for (let i=0; i<this.children.length; i++) {
      result.push(equalSize);
    }
    return result;
  }

  _toFlatObject() {
    const flat = super._toFlatObject();
    flat.orientation = this._orientation;
    return flat;
  }

  getBoundingClientRect() {
    return {
      left: 100,
      right: 100 + this._width,
      width: this._width,
      top: 300,
      bottom: 300 + this._height,
      height: this._height
    };
  }

  update() {

  }
}

let tabWidgetCounter = 0;
class FakeTabWidget extends FakeElement {
  constructor() {
    super("TabWidget " + tabWidgetCounter);
    tabWidgetCounter++;
  }

  setShowFrame(show) {

  }

  setShowTabs(show) {

  }

  update() {

  }
}

let tabCounter = 0;
class FakeTab extends FakeElement {
  constructor() {
    super("Tab " + tabCounter);
    tabCounter++;
  }
}

let divCounter = 0;
class FakeDiv extends FakeElement {
  constructor(name=null) {
    if (name == null) {
      super("Div " + divCounter);
    } else {
      super(name);
    }
    divCounter++;
  }
}

function flattenSplitLayout(layout) {
  const flatResult = {};
  for (const key in layout) {
    const value = layout[key];
    if (typeof value === "string" || typeof value === "number") {
      flatResult[key] = value;
    } else if (typeof value === "object") {

      if (value instanceof FakeElement) {
        flatResult[key] = `<${value.name}>`;
      } else {
        flatResult[key] = flattenSplitLayout(value);
      }
    }
  }
  return flatResult;
}

document.createElement = (elName) => {
  if (elName === "et-splitter") {
    return <any> new FakeSplitter();
  } else if (elName === "et-tab-widget") {
    return <any> new FakeTabWidget();
  } else if (elName === "et-tab") {
    return <any> makeFakeTab();
  } else if (elName === "DIV") {
    return <any> makeFakeDiv();
  }
  console.log("Create element "+elName);
  return null;
};


function makeFakeElement(): Element {
  return <Element> <unknown> new FakeElement("Root");
}

function makeFakeDiv(name: string=""): HTMLDivElement {
  return <HTMLDivElement> <unknown> new FakeDiv(name);
}

function makeFakeTab(): Tab {
  return <Tab> <unknown> new FakeTab();
}

beforeEach(() => {
  splitterCounter = 0;
  tabWidgetCounter = 0;
  tabCounter = 0;
  divCounter = 0;
});

test("empty", () => {
  const splitLayout = new SplitLayout();
  const container = <Element> <unknown> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.update();

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(0);
});

test("OneTab", () => {
  const splitLayout = new SplitLayout();
  const container = <Element> <unknown> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <Element> <unknown> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <Element> <unknown> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  // console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(2);
});

test("TwoTabs", () => {
  const splitLayout = new SplitLayout();
  const container = <Element> <unknown> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <Element> <unknown> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <Element> <unknown> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <Element> <unknown> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  // console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(4);
});


test("split", () => {
  const splitLayout = new SplitLayout();
  const container = <Element> <unknown> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <Element> <unknown> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
});

test("Close Split", () => {
  const splitLayout = new SplitLayout();
  const container = <Element> <unknown> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <Element> <unknown> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.closeSplitAtTabContent(tabContents2);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(4);
});


test("Split2", () => {
  const splitLayout = new SplitLayout();
  const container = <any> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <any> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = <any> makeFakeTab();
  const tabContents3 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(3);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
  expect(container.children.item(0).children.item(2).children.length).toBe(2);
});

test("Split Remove Content", () => {
  const splitLayout = new SplitLayout();
  const container = <any> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <any> makeFakeDiv();
    });
  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

  splitLayout.removeTabContent(tabContents);
  splitLayout.update();

// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(0);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
});

test("One Tab With Rest Content", () => {
  const splitLayout = new SplitLayout();
  const container = <any> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <any> makeFakeDiv();
    });

  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = <any> makeFakeDiv();
    div.name = "space";
    return div;
  } );

  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  // console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(3);
  expect(container.children.item(0).children.item(2).name).toBe("space");
});

test("Split With Rest Content", () => {
  const splitLayout = new SplitLayout();
  const container = <any> new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return <any> makeFakeDiv();
    });

  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = <any> makeFakeDiv();
    div.name = "space";
    return div;
  } );

  const tab = <any> makeFakeTab();
  const tabContents = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = <any> makeFakeTab();
  const tabContents2 = <any> makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(3);
  expect(container.children.item(0).children.item(1).children.length).toBe(3);
});

test("Split Remove Content With Space" ,() => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = makeFakeDiv();
    (<any> div).name = "space";
    return div;
  } );


  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

  splitLayout.removeTabContent(tabContents);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(1);
  expect(container.children.item(0).children.item(1).children.length).toBe(3);
});


test("One Tab With Top Right", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const topRight = makeFakeDiv();
  (<any> topRight).name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(3);
});

test("One Tab With Top Right And Space", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = makeFakeDiv();
    (<any> div).name = "space";
    return div;
  } );

  const topRight = makeFakeDiv();
  (<any> topRight).name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(3);
  expect((<any> container.children.item(0).children.item(2)).name).toBe("top right");
});

test("Two Tab Split With Top Right And Space", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = makeFakeDiv();
    (<any> div).name = "space";
    return div;
  } );

  const topRight = makeFakeDiv();
  (<any> topRight).name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);
  splitLayout.update();

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(2);
  expect((<any> container.children.item(0).children.item(1).children.item(2)).name).toBe("top right");
  expect(container.children.item(0).children.item(0).children.length).toBe(3);
  expect((<any> container.children.item(0).children.item(0).children.item(2)).name).toBe("space");
});

test("Empty With Fallback", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setEmptySplitElementFactory( () => {
    const div = makeFakeDiv();
    (<any> div).name = "fallback";
    return div;
  });
  splitLayout.update();

  expect(container.children.length).toBe(1);
  expect(container.children.item(0).children.length).toBe(2);

  // console.log(JSON.stringify(container,null,2));
});

test("Split 2 With Fallback", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  splitLayout.setEmptySplitElementFactory( () => {
    const div = makeFakeDiv();
    (<any>div).name = "fallback";
    return div;
  });
  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  const tabWidget = splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabWidget(tabWidget, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(3);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
  expect((<any>container.children.item(0).children.item(1).children.item(1).children.item(0)).name).toBe("fallback");
});

test("Horizontal Split", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.HORIZONTAL);

  splitLayout.update();

// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

// console.log(JSON.stringify(container,null,2));
  expect(container.children.length).toBe(1);
  expect((<any>container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect((<any>container.children.item(0))._orientation).toBe(SplitOrientation.HORIZONTAL);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
});

test("Mix Split", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });
  const tab = makeFakeTab();
  const tabContents = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = makeFakeTab();
  const tabContents3 = makeFakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.HORIZONTAL);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(1).children.length).toBe(2);
});

test("Mix Split 2", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const tab1_1 = makeFakeTab();
  const tabContents1_1 = makeFakeDiv("tabContents1_1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1_1, tabContents1_1);

  const tab = makeFakeTab();
  const tabContents = makeFakeDiv("tabContents");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);


  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = makeFakeTab();
  const tabContents3 = makeFakeDiv("tabContents3");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents1_1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter"), ).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(1).children.length).toBe(2);
});

test("Close Mix Split", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const tab1 = makeFakeTab();
  const tabContents1 = makeFakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);


  const tab3 = makeFakeTab();
  const tabContents3 = makeFakeDiv("tabContents3");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  const tab4 = makeFakeTab();
  const tabContents4 = makeFakeDiv("tabContents4");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab4, tabContents4);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents3, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.closeSplitAtTabContent(tabContents1);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(4);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.item(1).children.length).toBe(2);
});

test("Nested Splits", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const tab1 = makeFakeTab();
  const tabContents1 = makeFakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const newTabWidget = splitLayout.splitAfterTabContent(tabContents1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.splitAfterTabWidget(newTabWidget, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
});

test("Navigation", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const tab1 = makeFakeTab();
  const tabContents1 = makeFakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = makeFakeTab();
  const tabContents3 = makeFakeDiv("tabContents3");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  const tab4 = makeFakeTab();
  const tabContents4 = makeFakeDiv("tabContents4");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab4, tabContents4);

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.VERTICAL);
  splitLayout.splitAfterTabContent(tabContents3, SplitOrientation.HORIZONTAL);
  splitLayout.splitAfterTabContent(tabContents1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  const tabWidget1 = splitLayout.getTabWidgetByTabContent(tabContents1);
  const tabWidget2 = splitLayout.getTabWidgetByTabContent(tabContents2);
  const tabWidget3 = splitLayout.getTabWidgetByTabContent(tabContents3);
  const tabWidget4 = splitLayout.getTabWidgetByTabContent(tabContents4);

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect((<any> splitLayout.getTabWidgetBelow(tabWidget1)).name).toBe((<any> tabWidget2).name);
  expect((<any> splitLayout.getTabWidgetAbove(tabWidget2)).name).toBe((<any> tabWidget1).name);
  expect((<any> splitLayout.getTabWidgetBelow(tabWidget3)).name).toBe((<any> tabWidget4).name);
  expect((<any> splitLayout.getTabWidgetAbove(tabWidget4)).name).toBe((<any> tabWidget3).name);
});

test("Close 3 Mix Split", () => {
  const splitLayout = new SplitLayout();
  const container = makeFakeElement();
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return makeFakeDiv();
    });

  const tab1 = makeFakeTab();
  const tabContents1 = makeFakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const tab2 = makeFakeTab();
  const tabContents2 = makeFakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);


  const tab3 = makeFakeTab();
  const tabContents3 = makeFakeDiv("tabContents3");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.closeSplitAtTabContent(tabContents3);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  expect(container.children.length).toBe(1);
  expect((<any> container.children.item(0)).name.startsWith("Splitter")).toBe(true);
  expect(container.children.item(0).children.length).toBe(2);
  expect(container.children.item(0).children.item(0).children.length).toBe(4);
  expect(container.children.item(0).children.item(1).children.length).toBe(2);
});
