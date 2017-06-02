
let SnapDropContainer = null;
let ResizeRefreshElementBase = null;

function start() {
  console.log("Starting");

  require(["./ThemeConsumer", "./ResizeRefreshElementBase", "./gui/SnapDropContainer", "./cssmap"],
    function(ThemeConsumer, _ResizeRefreshElementBase, SnapDropContainerModule, style) {

    SnapDropContainer = SnapDropContainerModule.SnapDropContainer;

    ThemeConsumer.updateCss(style);

    SnapDropContainer.init();
  });
}
