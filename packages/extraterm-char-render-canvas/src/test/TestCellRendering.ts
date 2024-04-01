import { GlobalColor, QImage, QImageFormat, QPainter } from "@nodegui/nodegui";
import { CharCellLine } from "extraterm-char-cell-line";
import { CellPainter, EmbeddedImage, EmbeddedImageMap } from "../CellPainter.js";
import { computeFontMetrics } from "../font_metrics/FontMeasurement.js";
import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics.js";
import { TextureFontAtlas } from "../font_atlas/TextureFontAtlas.js";
import { xtermPalette } from "../XTermPalette.js";

const log = console.log.bind(console);

const GRID_WIDTH = 40;
const GRID_HEIGHT = 25;

function main(): void {

  const metrics: MonospaceFontMetrics = computeFontMetrics("DejaVu Sans Mono", "book", 20);
  const atlas = new TextureFontAtlas(metrics, [], false, 2560, 1440);

  const image = new QImage(metrics.widthPx * GRID_WIDTH, metrics.heightPx * GRID_HEIGHT, QImageFormat.ARGB32);
  image.fill(GlobalColor.white);

  const simeImage = new QImage();
  log(`Loading sime image: ${simeImage.load("sime_poppetje.png")}`);

  const qpainter = new QPainter(image);

  const palette = xtermPalette();

  const cellPainter = new CellPainter(
    qpainter, // painter
    atlas,    // fontAtlas
    metrics,  // fontMetrics
    1,        // dpr
    palette,  // palette
    0,        // cursorColor
    []        // fontSlices
  );

  atlas.loadCodePoint("R".codePointAt(0), 0, 0, 0xff0000ff, 0x00000000);
  atlas.loadCodePoint("G".codePointAt(0), 0, 0, 0x00ff00ff, 0x00000000);
  atlas.loadCodePoint("B".codePointAt(0), 0, 0, 0x0000ffff, 0x00000000);

  const lines: CharCellLine[] = [];
  for (let i=0; i<GRID_HEIGHT; i++) {
    lines.push(new CharCellLine(GRID_WIDTH, palette));
  }

  const line = lines[0];
  line.setCodePoint(0, "R".codePointAt(0));
  line.setFgRGBA(0, 0xff0000ff);

  line.setCodePoint(1, "G".codePointAt(0));
  line.setFgRGBA(1, 0x00ff00ff);

  line.setCodePoint(2, "B".codePointAt(0));
  line.setFgRGBA(2, 0x0000ffff);

  const baseX = 3;
  const baseY = 1;
  for (let j=0; j< 20; j++) {
    for (let i=0; i< 20; i++) {
      const line = lines[j + baseY];
      line.setImageID(baseX + i, 1);
      line.setImageX(baseX + i, i);
      line.setImageY(baseX + i, j);
    }
  }

  const embeddedImageMap: EmbeddedImageMap = new Map<number, EmbeddedImage>();
  embeddedImageMap.set(1, {
    sourceImage: simeImage,
    sourceCellWidthPx: metrics.widthPx,
    sourceCellHeightPx: metrics.heightPx,

    image: simeImage,
    cellWidthPx: metrics.widthPx,
    cellHeightPx: metrics.heightPx,
  });

  for (let i=0; i<GRID_HEIGHT; i++) {
    cellPainter.renderLine(lines[i], metrics.heightPx * i, false, embeddedImageMap);
  }

  image.save("test_cell_rendering.png");
}

main();

log("Exiting normally");
process.exit(0);
