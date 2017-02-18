

function start() {
  console.log("Starting");

  const TabWidget = require(["./themeconsumer", "./gui/tabwidget", "./gui/tab", "./cssmap"],
    function(ThemeConsumer, TabWidget, Tab, style) {

    ThemeConsumer.updateCss(style);

    TabWidget.init();
    Tab.init();

    const cssMapping = new Map();
    for (const key in style) {
      cssMapping.set(key, style[key]);
    }

    const newTabWidget = document.createElement(TabWidget.TAG_NAME);

    for (let i=0; i< 3; i++) {
      const contentDiv = document.getElementById("content");
      contentDiv.appendChild(newTabWidget);

      const newTab = document.createElement(Tab.TAG_NAME);
      newTab.innerHTML = "<div>&nbsp;&nbsp;&nbsp;&nbsp;Tab "+i+"<span>[X]</span></div>";
      newTabWidget.appendChild(newTab);

      const newContent = document.createElement("DIV");
      newContent.innerHTML = "Tab " + i + " content";
      newTabWidget.appendChild(newContent);
      
    }
  });

}
