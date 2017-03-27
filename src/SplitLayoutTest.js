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
  }
}

class FakeElement {
  constructor(name) {
    this.name = name;
    this.children = new FakeChildrenArray();
  }
  appendChild(child) {
    this.children.push(child);
  }

  insertBefore(child, refChild) {
    const index = this.children._children.indexOf(refChild);
    this.children._children.splice(index, 0, child);
    this.children.length = this.children._children.length;
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
