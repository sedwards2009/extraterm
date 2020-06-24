
import { CharRenderCanvas, Renderer, xtermPalette } from "extraterm-char-render-canvas";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { testPattern } from "./TestPattern";

const log = console.log.bind(console);

function main(): void {
  log("Main!");
  const containerDiv = document.getElementById("container");

  const WIDTH_CHARS = 130;
  const HEIGHT_CHARS = 68;

  const renderCanvas = new CharRenderCanvas({
    widthChars: WIDTH_CHARS,
    heightChars: HEIGHT_CHARS,
    fontFamily: "dejavusansmono",
    fontSizePx: 16,
    palette: xtermPalette(),
    extraFonts: [
      {
        fontFamily: "twemoji",
        fontSizePx: 16,
        unicodeStart: 0x1f000,
        unicodeEnd: 0x20000,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ],
    renderer: Renderer.CPU,
  });

  containerDiv.appendChild(renderCanvas.getCanvasElement());

  const renderButton1 = document.getElementById("render_button1");
  renderButton1.addEventListener("click", () => {
    testPattern(renderCanvas.getCellGrid());
    renderCanvas.render();
    containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
  });

  const renderButton2 = document.getElementById("render_button2");
  renderButton2.addEventListener("click", () => {

    fillGridWithString(renderCanvas.getCellGrid(), "abcdefghijklmonpqrstuvwxyz");

    renderCanvas.render();
    containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
  });

  const renderButton3 = document.getElementById("render_button3");
  renderButton3.addEventListener("click", () => {

    fillGridWithString(renderCanvas.getCellGrid(), "ABCDEFGHIJKLMONPQRSTUVWXYZ");

    renderCanvas.render();
    containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
  });
}

function fillGridWithString(cellGrid: CharCellGrid, str: string): void {
  for (let y=0; y<cellGrid.height; y++) {
    cellGrid.setString(0, y, str);
    for (let x=0; x<cellGrid.width; x++) {
      cellGrid.setStyle(0, 0, 0);
    }
  }
}
window.onload = main;
