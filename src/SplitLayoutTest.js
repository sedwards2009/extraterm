/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

const nodeunit = require('nodeunit');
const sandbox = nodeunit.utils.sandbox;

const moduleRemap = {
  "./gui/Splitter": {
    Splitter: {
      TAG_NAME: "et-splitter"
    }
    
  },
  "./gui/TabWidget": {
    TabWidget: {
      TAG_NAME: "et-tabwidget"
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
  constructor() {
    super("Div " + divCounter);
    divCounter++;
  }  
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

  splitLayout.splitAfterTabContent(tabContents);

  splitLayout.update();

// console.log(JSON.stringify(splitLayout._rootInfoNode, null, 2));

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

  splitLayout.splitAfterTabContent(tabContents);

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

  splitLayout.splitAfterTabContent(tabContents);
  splitLayout.update();

  splitLayout.splitAfterTabContent(tabContents2);
  splitLayout.update();

console.log(JSON.stringify(container._toFlatObject(), null, 2));
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
