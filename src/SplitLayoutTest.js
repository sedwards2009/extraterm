/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

const nodeunit = require('nodeunit');
const sandbox = nodeunit.utils.sandbox;

const SplitOrientation = {
  VERTICAL: 0,
  HORIZONTAL: 1
};

const moduleRemap = {
  "./gui/Splitter": {
    Splitter: {
      TAG_NAME: "et-splitter"
    },
    SplitOrientation: SplitOrientation
  },

  "./gui/TabWidget": {
    TabWidget: {
      TAG_NAME: "et-tabwidget"
    }
  },

  "./gui/Tab": {
    Tab: {
      TAG_NAME: "et-tab"
    }
  }
}

function requireWedge(modName) {
  console.log("Requiring " + modName);
  if (moduleRemap[modName] != null) {
    return moduleRemap[modName];
  }
  return require(modName);
}

class FakeChildrenArray {
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
  constructor(name) {
    this.name = name;
    this.children = new FakeChildrenArray();
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
    return { name: this.name, children: this.children._children.map( c => c._toFlatObject() ) };
  }
}

let splitterCounter = 0;
class FakeSplitter extends FakeElement {
  constructor() {
    super("Splitter " + splitterCounter);
    splitterCounter++;
    this._orientation = SplitOrientation.VERTICAL;
  }

  setSplitOrientation(orientation) {
    this._orientation = orientation;
  }

  _toFlatObject() {
    const flat = super._toFlatObject();
    flat.orientation = this._orientation;
    return flat;
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

function setUp(callback) {
  splitterCounter = 0;
  tabWidgetCounter = 0;
  tabCounter = 0;
  divCounter = 0;
  callback();
}
exports.setUp = setUp;

const context = {
  require: requireWedge,
  console: console,
  exports: {},
  document: {
    createElement: (elName) => {

      if (elName === "et-splitter") {
        return new FakeSplitter();
      } else if (elName === "et-tabwidget") {
        return new FakeTabWidget();
      } else if (elName === "et-tab") {
        return new FakeTab();
      } else if (elName === "DIV") {
        return new FakeDiv();
      }
      console.log("Create element "+elName);
      return null;
    }
  }
};
const SplitLayout = sandbox("./src/SplitLayout.js", context).exports.SplitLayout;

function testEmpty(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.update();

  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 0);

  // console.log(JSON.stringify(container,null,2));
  test.done();
}
exports.testEmpty = testEmpty;

function testOneTab(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  // console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 2);

  test.done();
}
exports.testOneTab = testOneTab;

function testTwoTabs(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  // console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 4);

  test.done();
}
exports.testTwoTabs = testTwoTabs;

function testSplit(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);

  test.done();
}
exports.testSplit = testSplit;

function testCloseSplit(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.closeSplitAtTabContent(tabContents2);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 4);

  test.done();
}
exports.testCloseSplit = testCloseSplit;

function testSplit2(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = new FakeTab();
  const tabContents3 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 3);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);
  test.equal(container.children.item(0).children.item(2).children.length, 2);

  test.done();
}
exports.testSplit2 = testSplit2;

function testSplitRemoveContent(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

  splitLayout.removeTabContent(tabContents);
  splitLayout.update();

// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 0);
  test.equal(container.children.item(0).children.item(1).children.length, 2);

  test.done();
}
exports.testSplitRemoveContent = testSplitRemoveContent;


function testOneTabWithRestContent(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = new FakeDiv();
    div.name = "space";
    return div;
  } );

  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  // console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 3);
  test.equal(container.children.item(0).children.item(2).name, "space");

  test.done();
}
exports.testOneTabWithRestContent = testOneTabWithRestContent;

function testSplitWithRestContent(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = new FakeDiv();
    div.name = "space";
    return div;
  } );

  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 3);
  test.equal(container.children.item(0).children.item(1).children.length, 3);

  test.done();
}
exports.testSplitWithRestContent = testSplitWithRestContent;

function testSplitRemoveContentWithSpace(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = new FakeDiv();
    div.name = "space";
    return div;
  } );


  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);

  splitLayout.update();

  splitLayout.removeTabContent(tabContents);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 1);
  test.equal(container.children.item(0).children.item(1).children.length, 3);

  test.done();
}
exports.testSplitRemoveContentWithSpace = testSplitRemoveContentWithSpace;


function testOneTabWithTopRight(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  const topRight = new FakeDiv();
  topRight.name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 3);

  test.done();
}
exports.testOneTabWithTopRight = testOneTabWithTopRight;

function testOneTabWithTopRightAndSpace(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = new FakeDiv();
    div.name = "space";
    return div;
  } );

  const topRight = new FakeDiv();
  topRight.name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 3);
  test.equal(container.children.item(0).children.item(2).name, "top right");

  test.done();
}
exports.testOneTabWithTopRightAndSpace = testOneTabWithTopRightAndSpace;

function testTwoTabSplitWithTopRightAndSpace(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  splitLayout.setRightSpaceDefaultElementFactory( () => {
    const div = new FakeDiv();
    div.name = "space";
    return div;
  } );

  const topRight = new FakeDiv();
  topRight.name = "top right";
  splitLayout.setTopRightElement(topRight);

  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);
  splitLayout.update();

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(2).name, "top right");
  test.equal(container.children.item(0).children.item(0).children.length, 3);
  test.equal(container.children.item(0).children.item(0).children.item(2).name, "space");

  test.done();
}
exports.testTwoTabSplitWithTopRightAndSpace = testTwoTabSplitWithTopRightAndSpace;

function testEmptyWithFallback(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setEmptySplitElementFactory( () => {
    const div = new FakeDiv();
    div.name = "fallback";
    return div;
  });
  splitLayout.update();

  test.equal(container.children.length, 1);
  test.equal(container.children.item(0).children.length, 2);

  // console.log(JSON.stringify(container,null,2));
  test.done();
}
exports.testEmptyWithFallback = testEmptyWithFallback;

function testSplit2WithFallback(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  splitLayout.setEmptySplitElementFactory( () => {
    const div = new FakeDiv();
    div.name = "fallback";
    return div;
  });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  splitLayout.update();

  const { tabWidget } = splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();
 
  splitLayout.splitAfterTabWidget(tabWidget, SplitOrientation.VERTICAL);
  splitLayout.update();

// console.log(JSON.stringify(container._toFlatObject(), null, 2));
// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(1).children.item(0).name, "fallback");

  test.done();
}
exports.testSplit2WithFallback = testSplit2WithFallback;

function testHorizontalSplit(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.HORIZONTAL);

  splitLayout.update();

// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

// console.log(JSON.stringify(container,null,2));
  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equals(container.children.item(0)._orientation, SplitOrientation.HORIZONTAL);
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);

  test.done();
}
exports.testHorizontalSplit = testHorizontalSplit;

function testMixSplit(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });
  const tab = new FakeTab();
  const tabContents = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = new FakeTab();
  const tabContents3 = new FakeDiv();
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents, SplitOrientation.VERTICAL);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2, SplitOrientation.HORIZONTAL);
  splitLayout.update();

// console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(1).children.length, 2);

  test.done();
}
exports.testMixSplit = testMixSplit;

function testMixSplit2(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  const tab1_1 = new FakeTab();
  const tabContents1_1 = new FakeDiv("tabContents1_1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1_1, tabContents1_1);

  const tab = new FakeTab();
  const tabContents = new FakeDiv("tabContents");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab, tabContents);


  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);

  const tab3 = new FakeTab();
  const tabContents3 = new FakeDiv("tabContents3");
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

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(1).children.length, 2);

  test.done();
}
exports.testMixSplit2 = testMixSplit2;

function testCloseMixSplit(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  const tab1 = new FakeTab();
  const tabContents1 = new FakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const tab2 = new FakeTab();
  const tabContents2 = new FakeDiv("tabContents2");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab2, tabContents2);


  const tab3 = new FakeTab();
  const tabContents3 = new FakeDiv("tabContents3");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab3, tabContents3);

  const tab4 = new FakeTab();
  const tabContents4 = new FakeDiv("tabContents4");
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

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 4);
  test.equal(container.children.item(0).children.item(1).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.item(1).children.length, 2);

  test.done();
}
exports.testCloseMixSplit = testCloseMixSplit;

function testNestedSplits(test) {
  const splitLayout = new SplitLayout();
  const container = new FakeElement("Root");
  splitLayout.setRootContainer(container);
  splitLayout.setTabContainerFactory(
    (tabWidget, tab, tabContent) => {
      return new FakeDiv();
    });

  const tab1 = new FakeTab();
  const tabContents1 = new FakeDiv("tabContents1");
  splitLayout.appendTab(splitLayout.firstTabWidget(), tab1, tabContents1);

  const newTabWidget = splitLayout.splitAfterTabContent(tabContents1, SplitOrientation.HORIZONTAL);
  splitLayout.update();

  splitLayout.splitAfterTabWidget(newTabWidget, SplitOrientation.VERTICAL);
  splitLayout.update();

console.log(JSON.stringify(flattenSplitLayout(splitLayout._rootInfoNode), null, 2));
// console.log(JSON.stringify(container._toFlatObject(), null, 2));

  test.equal(container.children.length, 1);
  test.ok(container.children.item(0).name.startsWith("Splitter"));
  test.equal(container.children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(0).children.length, 2);
  test.equal(container.children.item(0).children.item(1).children.length, 2);

  test.done();
}
exports.testCloseMixSplitestNestedSplits = testNestedSplits;
