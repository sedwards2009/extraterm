import { QFontDatabase } from "@nodegui/nodegui";
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_OVERLINE, STYLE_MASK_HYPERLINK, STYLE_MASK_HYPERLINK_HIGHLIGHT, UNDERLINE_STYLE_NORMAL,
  UNDERLINE_STYLE_DOUBLE, UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-line";

import { TextureFontAtlas } from "../../font_atlas/TextureFontAtlas.js";
import { computeFontMetrics } from "../FontMeasurement.js";
import { MonospaceFontMetrics } from "../MonospaceFontMetrics.js";

const log = console.log.bind(console);

function insertString(str: string, style: number, fg: number, bg: number): void {
  for (let i=0; i<str.length; i++) {
    atlas.loadCodePoint(str.codePointAt(i), style, 0, fg, bg);
  }
}

log("Font Metrics Test App");

// const database = new QFontDatabase();
// log(database.families().join("\n"));

const metrics: MonospaceFontMetrics = computeFontMetrics("DejaVu Sans Mono", "book", 20);
log(JSON.stringify(metrics, null, "  "));

const atlas = new TextureFontAtlas(metrics, [], false, 2560, 1440);

insertString("Extraterm", 0, 0xffffffff, 0x00000000);

atlas.loadCodePoint("R".codePointAt(0), 0, 0, 0xff0000ff, 0x00000000);
atlas.loadCodePoint("G".codePointAt(0), 0, 0, 0x00ff00ff, 0x00000000);
atlas.loadCodePoint("B".codePointAt(0), 0, 0, 0x0000ffff, 0x00000000);

atlas.loadCodePoint("R".codePointAt(0), 0, 0, 0xffffffff, 0xff00000ff);
atlas.loadCodePoint("G".codePointAt(0), 0, 0, 0xffffffff, 0x00ff00ff);
atlas.loadCodePoint("B".codePointAt(0), 0, 0, 0xffffffff, 0x0000ffff);

insertString("Bold", STYLE_MASK_BOLD, 0xffffffff, 0x00000000);
insertString("Italic", STYLE_MASK_ITALIC, 0xffffffff, 0x00000000);
insertString("Underline", UNDERLINE_STYLE_NORMAL, 0xffffffff, 0x00000000);
insertString("Strikethrough", STYLE_MASK_STRIKETHROUGH, 0xffffffff, 0x00000000);
insertString("Overline", STYLE_MASK_OVERLINE, 0xffffffff, 0x00000000);
insertString("DoubleUnderline", UNDERLINE_STYLE_DOUBLE, 0xffffffff, 0x00000000);
insertString("CurlyUnderline", UNDERLINE_STYLE_CURLY, 0xffffffff, 0x00000000);
insertString("Hyperlink", STYLE_MASK_HYPERLINK, 0xffffffff, 0x00000000);

atlas.loadCodePoint(0x2573, 0, 0, 0xffffffff, 0x00000000);
atlas.loadCodePoint(0x2572, 0, 0, 0xffffffff, 0x00000000);
atlas.loadCodePoint(0x2571, 0, 0, 0xffffffff, 0x00000000);
atlas.loadCodePoint(0x256D, 0, 0, 0xffffffff, 0x00000000);
atlas.loadCodePoint(0x2592, 0, 0, 0xffffffff, 0x00000000);

atlas.loadCodePoint("⚠️".codePointAt(0), 0, 0, 0xffffffff, 0x00000000);

const saveFilename = "test_font_metrics.png";
log(`Saving image ${saveFilename}`);
const image = atlas.getQImage();
image.save(saveFilename);

log("Exiting normally");
process.exit(0);
