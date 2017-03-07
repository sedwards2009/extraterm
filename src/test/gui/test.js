
let TabWidget = null;
let Tab = null;
let Splitter = null;
let ResizeRefreshElementBase = null;

function start() {
  console.log("Starting");

  document.getElementById("add_pane_button").addEventListener("click", () => {
    const splitter = document.getElementById("splitter");

    let text = "" + Math.floor(Math.random()*1000) + " ";
    text = text + text;
    text = text + text;
    text = text + text;
    text = text + text;
    text = text + text;

    const newDiv = document.createElement("DIV");
    newDiv.innerHTML = text;
    splitter.appendChild(newDiv);
  });

  document.getElementById("prepend_pane_button").addEventListener("click", () => {
    const splitter = document.getElementById("splitter");

    let text = "" + Math.floor(Math.random()*1000) + " ";
    text = text + text;
    text = text + text;
    text = text + text;
    text = text + text;
    text = text + text;

    const newDiv = document.createElement("DIV");
    newDiv.innerHTML = text;
    splitter.insertBefore(newDiv, splitter.firstElementChild);
  });
  

  document.getElementById("remove_last_pane_button").addEventListener("click", () => {
    const splitter = document.getElementById("splitter");

    if (splitter.children.length !== 0) {
      splitter.removeChild(splitter.children.item(splitter.children.length-1));
    }
  });

  document.getElementById("remove_first_pane_button").addEventListener("click", () => {
    const splitter = document.getElementById("splitter");

    if (splitter.children.length !== 0) {
      splitter.removeChild(splitter.children.item(0));
    }
  });

  document.getElementById("remove_middlet_pane_button").addEventListener("click", () => {
    const splitter = document.getElementById("splitter");

    if (splitter.children.length !== 0) {
      splitter.removeChild(splitter.children.item(Math.floor(splitter.children.length/2)));
    }
  });

  document.getElementById("big_splitter").addEventListener("click", () => {
    const splitterContainer = document.getElementById("splitter_container");
    splitterContainer.classList.add("big");

    const splitter = document.getElementById("splitter");
    splitter.refresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);

  });
  document.getElementById("small_splitter").addEventListener("click", () => {
    const splitterContainer = document.getElementById("splitter_container");
    splitterContainer.classList.remove("big");

    const splitter = document.getElementById("splitter");
    splitter.refresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);
  });

  require(["./ThemeConsumer", "./ResizeRefreshElementBase", "./gui/TabWidget", "./gui/Tab", "./gui/Splitter", "./cssmap"],
    function(ThemeConsumer, _ResizeRefreshElementBase, TabWidgetModule, TabModule, SplitterModule, style) {

    ResizeRefreshElementBase = _ResizeRefreshElementBase;
    TabWidget = TabWidgetModule.TabWidget;
    Tab = TabModule.Tab;
    Splitter = SplitterModule.Splitter;

    SetupCustomElement();

    ThemeConsumer.updateCss(style);

    TabWidget.init();
    Tab.init();
    Splitter.init();

    const cssMapping = new Map();
    for (const key in style) {
      cssMapping.set(key, style[key]);
    }

    const contentDiv = document.getElementById("content");
    contentDiv.appendChild(makeTabBar());
  });

}

function makeTabBar() {
  const newTabWidget = document.createElement(TabWidget.TAG_NAME);
  for (let i=0; i< 3; i++) {
    const newTab = document.createElement(Tab.TAG_NAME);
    newTab.innerHTML = "<div>&nbsp;&nbsp;&nbsp;&nbsp;Tab <div class='inline'>"+i+"<span>[X]</span></div></div>";
    newTabWidget.appendChild(newTab);

    const newContent = document.createElement("DIV");
    newContent.innerHTML = "Tab " + i + " content";
    newTabWidget.appendChild(newContent);
  }
  return newTabWidget;
}

function SetupCustomElement() {
  window.document.registerElement("shadow-container", {prototype: ShadowyContainer.prototype});
  window.document.registerElement("shadow-owner", {prototype: ShadowyOwner.prototype});
}

class ShadowyContainer extends HTMLElement {

  createdCallback() {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });

    const div = document.createElement("DIV");
    const slot = document.createElement("SLOT");
    div.appendChild(slot);

    shadow.appendChild(div);
  }
  
  attachedCallback() {
  }
}

class ShadowyOwner extends HTMLElement {

  createdCallback() {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });

    const div = document.createElement("DIV");
    div.appendChild(makeTabBar());
    shadow.appendChild(div);
  }
  
  attachedCallback() {
  }
}
