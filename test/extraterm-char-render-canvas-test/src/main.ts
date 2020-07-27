
import { CharRenderCanvas, Renderer, xtermPalette, TextureFontAtlas, WebGLRenderer, computeFontMetrics, MonospaceFontMetrics, WebGLCharRenderCanvas } from "extraterm-char-render-canvas";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { printTestPattern, printEmoji, CellGridOutputDevice, printPalette } from "./TestPattern";
import { WebGLRendererRepository } from "extraterm-char-render-canvas/dist/WebGLRendererRepository";

const webGLRendererRepository = new WebGLRendererRepository();


const log = console.log.bind(console);

const WIDTH_CHARS = 130;
const HEIGHT_CHARS = 68;
let renderCanvas: CharRenderCanvas = null;
let webglRenderCanvas: WebGLCharRenderCanvas = null;

function main(): void {
  log("Main!");

  const renderButton1 = document.getElementById("render_button1");
  renderButton1.addEventListener("click", renderTestPattern);

  const renderButton2 = document.getElementById("render_button2");
  renderButton2.addEventListener("click", renderLowerAlphaPattern);

  const renderButton3 = document.getElementById("render_button3");
  renderButton3.addEventListener("click", renderUpperAlphaPattern);

  const renderButton4 = document.getElementById("render_button4");
  renderButton4.addEventListener("click", renderEmoji);

  const renderButton5 = document.getElementById("render_button5");
  renderButton5.addEventListener("click", testWebGL);

  const renderButton6 = document.getElementById("render_button6");
  renderButton6.addEventListener("click", renderWebGLTestPattern);

  const renderButton7 = document.getElementById("render_button7");
  renderButton7.addEventListener("click", renderWebGLLowerAlphaPattern);

  const renderButton8 = document.getElementById("render_button8");
  renderButton8.addEventListener("click", renderWebGLUpperAlphaPattern);

}

function renderTestPattern(): void {
  const containerDiv = document.getElementById("container");
  createRenderCanvas();
  printTestPattern(new CellGridOutputDevice(renderCanvas.getCellGrid()));
  renderCanvas.render();
  containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
}

function renderLowerAlphaPattern(): void {
  const containerDiv = document.getElementById("container");
  createRenderCanvas();
  fillGridWithString(renderCanvas.getCellGrid(), "abcdefghijklmonpqrstuvwxyz");
  renderCanvas.render();
  containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
}

function renderUpperAlphaPattern(): void {
  const containerDiv = document.getElementById("container");
  createRenderCanvas();
  fillGridWithString(renderCanvas.getCellGrid(), "ABCDEFGHIJKLMONPQRSTUVWXYZ");
  renderCanvas.render();
  containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
}

function renderEmoji(): void {
  const containerDiv = document.getElementById("container");
  createRenderCanvas();
  printEmoji(new CellGridOutputDevice(renderCanvas.getCellGrid()));
  renderCanvas.render();
  containerDiv.appendChild(renderCanvas.getFontAtlasCanvasElement());
}

function createRenderCanvas(): void {
  if (renderCanvas != null) {
    return;
  }

  const containerDiv = document.getElementById("container");
  renderCanvas = new CharRenderCanvas({
    widthChars: WIDTH_CHARS,
    heightChars: HEIGHT_CHARS,
    fontFamily: "ligadejavusansmono",
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
}

function fillGridWithString(cellGrid: CharCellGrid, str: string): void {
  for (let y=0; y<cellGrid.height; y++) {
    cellGrid.setString(0, y, str);
    for (let x=0; x<cellGrid.width; x++) {
      cellGrid.setStyle(0, 0, 0);
    }
  }
}

function testWebGL(): void {
  const containerDiv = document.getElementById("container");

  const metrics = computeFontMetrics("ligadejavusansmono", 16);
  const customMetrics = computeEmojiMetrics(metrics);
  const fontAtlas = new TextureFontAtlas(metrics, [customMetrics], false);

  containerDiv.appendChild(fontAtlas.getCanvas());

  const renderer = new WebGLRenderer(fontAtlas, false);
  renderer.init();

  const cellGrid = new CharCellGrid(250, 30, xtermPalette());

  const outputDevice = new CellGridOutputDevice(cellGrid);
  printPalette(outputDevice);
  outputDevice.cr();
  printEmoji(outputDevice);
  outputDevice.cr();

  renderer.render(null, cellGrid);
}

function computeEmojiMetrics(metrics: MonospaceFontMetrics): MonospaceFontMetrics {
  const extraFontFamily = "twemoji";
  const extraFontSizePx = 16;
  const customMetrics = {
    ...metrics,
    fontFamily: extraFontFamily,
    fontSizePx: extraFontSizePx,
  };
  const actualFontMetrics = computeFontMetrics(extraFontFamily, extraFontSizePx, ["\u{1f600}"]  /* Smile emoji */);
  customMetrics.fontSizePx = actualFontMetrics.fontSizePx;
  customMetrics.fillTextYOffset = actualFontMetrics.fillTextYOffset;

  return customMetrics;
}

function renderWebGLTestPattern(): void {
  createWebGLRenderCanvas();
  webglRenderCanvas.getCellGrid().clear();
  printTestPattern(new CellGridOutputDevice(webglRenderCanvas.getCellGrid()));
  webglRenderCanvas.render();
}

function renderWebGLLowerAlphaPattern(): void {
  createWebGLRenderCanvas();
  fillGridWithString(webglRenderCanvas.getCellGrid(), "ABCDEFGHIJKLMONPQRSTUVWXYZ");
  webglRenderCanvas.render();
}

function renderWebGLUpperAlphaPattern(): void {
  createWebGLRenderCanvas();
  fillGridWithString(webglRenderCanvas.getCellGrid(), "abcdefghijklmonpqrstuvwxyz");
  webglRenderCanvas.render();
}

function createWebGLRenderCanvas(): void {
  if (webglRenderCanvas != null) {
    return;
  }

  const palette = xtermPalette();
  palette[256] = 0x00000000;

  const containerDiv = document.getElementById("container");
  webglRenderCanvas = new WebGLCharRenderCanvas({
    widthChars: WIDTH_CHARS,
    heightChars: HEIGHT_CHARS,
    fontFamily: "ligadejavusansmono",
    fontSizePx: 16,
    palette,
    extraFonts: [
      {
        fontFamily: "twemoji",
        fontSizePx: 16,
        unicodeStart: 0x1f000,
        unicodeEnd: 0x20000,
        sampleChars: ["\u{1f600}"]  // Smile emoji
      }
    ],
    webGLRendererRepository,
    transparentBackground: false
  });

  containerDiv.appendChild(webglRenderCanvas.getCanvasElement());
  containerDiv.appendChild(webglRenderCanvas.getFontAtlasCanvasElement());
  containerDiv.appendChild((<any>webglRenderCanvas)._webglRenderer._canvas);
}


window.onload = main;
