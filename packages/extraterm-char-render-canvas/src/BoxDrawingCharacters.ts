/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Logger, getLogger, log } from "extraterm-logging";


const _log = getLogger("BoxDrawingCharacters");

const FIRST_BOX_CODE_POINT = 0x2500;

export function isBoxCharacter(codePoint: number): boolean {
  return codePoint >= FIRST_BOX_CODE_POINT && codePoint < (FIRST_BOX_CODE_POINT + boxGlyphs5x5.length);
}

const GRID_WIDTH = 5;
const GRID_HEIGHT = 5;

const boxGlyphs5x5 = [
  // 0x2500 BOX DRAWINGS LIGHT HORIZONTAL
  "....." +
  "....." +
  "#####" +
  "....." +
  ".....",

  // 0x2501 BOX DRAWINGS HEAVY HORIZONTAL
  "....." +
  "#####" +
  "#####" +
  "#####" +
  ".....",

  // 0x2502 BOX DRAWINGS LIGHT VERTICAL
  "..#.." +
  "..#.." +
  "..#.." +
  "..#.." +
  "..#..",

  // 0x2503 BOX DRAWINGS HEAVY VERTICAL
  ".###." +
  ".###." +
  ".###." +
  ".###." +
  ".###.",

  // 0x2504 BOX DRAWINGS LIGHT TRIPLE DASH HORIZONTAL
  "....." +
  "....." +
  "#.#.#" +
  "....." +
  ".....",

  // 0x2505 BOX DRAWINGS HEAVY TRIPLE DASH HORIZONTAL
  "....." +
  "#.#.#" +
  "#.#.#" +
  "#.#.#" +
  ".....",

  // 0x2506 BOX DRAWINGS LIGHT TRIPLE DASH VERTICAL
  "..#.." +
  "....." +
  "..#.." +
  "....." +
  "..#..",

  // 0x2507 BOX DRAWINGS HEAVY TRIPLE DASH VERTICAL
  ".###." +
  "....." +
  ".###." +
  "....." +
  ".###.",

  // 0x2508 BOX DRAWINGS LIGHT QUADRUPLE DASH HORIZONTAL
  "....." +
  "....." +
  "##.##" +
  "....." +
  ".....",

  // 0x2509 BOX DRAWINGS HEAVY QUADRUPLE DASH HORIZONTAL
  "....." +
  "##.##" +
  "##.##" +
  "##.##" +
  ".....",

  // 0x250A BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
  "..#.." +
  "..#.." +
  "....." +
  "..#.." +
  "..#..",

  // 0x250B BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
  ".###." +
  ".###." +
  "....." +
  ".###." +
  ".###.",

  // 0x250C BOX DRAWINGS LIGHT DOWN AND RIGHT
  "....." +
  "....." +
  "..###" +
  "..#.." +
  "..#..",

  // 0x250D BOX DRAWINGS DOWN LIGHT AND RIGHT HEAVY
  "....." +
  "..###" +
  "..###" +
  "..###" +
  "..#..",

  // 0x250E BOX DRAWINGS DOWN HEAVY AND RIGHT LIGHT
  "....." +
  "....." +
  ".####" +
  ".###." +
  ".###.",

  // 0x250F BOX DRAWINGS HEAVY DOWN AND RIGHT
  "....." +
  ".####" +
  ".####" +
  ".####" +
  ".###.",

  // 0x2510 BOX DRAWINGS LIGHT DOWN AND LEFT
  "....." +
  "....." +
  "###.." +
  "..#.." +
  "..#..",

  // 0x2511 BOX DRAWINGS DOWN LIGHT AND LEFT HEAVY
  "....." +
  "###.." +
  "###.." +
  "###.." +
  "..#..",

  // 0x2512 BOX DRAWINGS DOWN HEAVY AND LEFT LIGHT
  "....." +
  "....." +
  "####." +
  ".###." +
  ".###.",

  // 0x2513 BOX DRAWINGS HEAVY DOWN AND LEFT
  "....." +
  "####." +
  "####." +
  "####." +
  ".###.",

  // 0x2514 BOX DRAWINGS LIGHT UP AND RIGHT
  "..#.." +
  "..#.." +
  "..###" +
  "....." +
  ".....",

  // 0x2515 BOX DRAWINGS UP LIGHT AND RIGHT HEAVY
  "..#.." +
  "..###" +
  "..###" +
  "..###" +
  ".....",

  // 0x2516 BOX DRAWINGS UP HEAVY AND RIGHT LIGHT
  ".###." +
  ".###." +
  ".####" +
  "....." +
  ".....",

  // 0x2517 BOX DRAWINGS HEAVY UP AND RIGHT
  ".###." +
  ".####" +
  ".####" +
  ".####" +
  ".....",

  // 0x2518 BOX DRAWINGS LIGHT UP AND LEFT
  "..#.." +
  "..#.." +
  "###.." +
  "....." +
  ".....",

  // 0x2519 BOX DRAWINGS UP LIGHT AND LEFT HEAVY
  "..#.." +
  "###.." +
  "###.." +
  "###.." +
  ".....",

  // 0x251A BOX DRAWINGS UP HEAVY AND LEFT LIGHT
  ".###." +
  ".###." +
  "####." +
  "....." +
  ".....",

  // 0x251B BOX DRAWINGS HEAVY UP AND LEFT
  ".###." +
  "####." +
  "####." +
  "####." +
  ".....",

  // 0x251C BOX DRAWINGS LIGHT VERTICAL AND RIGHT
  "..#.." +
  "..#.." +
  "..###" +
  "..#.." +
  "..#..",

  // 0x251D BOX DRAWINGS VERTICAL LIGHT AND RIGHT HEAVY
  "..#.." +
  "..###" +
  "..###" +
  "..###" +
  "..#..",

  // 0x251E BOX DRAWINGS UP HEAVY AND RIGHT DOWN LIGHT
  ".###." +
  ".###." +
  ".####" +
  "..#.." +
  "..#..",

  // 0x251F BOX DRAWINGS DOWN HEAVY AND RIGHT UP LIGHT
  "..#.." +
  "..#.." +
  ".####" +
  ".###." +
  ".###.",

  // 0x2520 BOX DRAWINGS VERTICAL HEAVY AND RIGHT LIGHT
  ".###." +
  ".###." +
  ".####" +
  ".###." +
  ".###.",

  // 0x2521 BOX DRAWINGS DOWN LIGHT AND RIGHT UP HEAVY
  "....." +
  "..###" +
  "..###" +
  "..###" +
  "..#..",

  // 0x2522 BOX DRAWINGS UP LIGHT AND RIGHT DOWN HEAVY
  "..#.." +
  "..#.." +
  ".####" +
  ".###." +
  ".###.",

  // 0x2523 BOX DRAWINGS HEAVY VERTICAL AND RIGHT
  ".###." +
  ".####" +
  ".####" +
  ".####" +
  ".###.",

  // 0x2524 BOX DRAWINGS LIGHT VERTICAL AND LEFT
  "..#.." +
  "..#.." +
  "###.." +
  "..#.." +
  "..#..",

  // 0x2525 BOX DRAWINGS VERTICAL LIGHT AND LEFT HEAVY
  "..#.." +
  "###.." +
  "###.." +
  "###.." +
  "..#..",

  // 0x2526 BOX DRAWINGS UP HEAVY AND LEFT DOWN LIGHT
  ".###." +
  "####." +
  "####." +
  "####." +
  "..#..",

  // 0x2527 BOX DRAWINGS DOWN HEAVY AND LEFT UP LIGHT
  "..#.." +
  "####." +
  "####." +
  "####." +
  ".###.",

  // 0x2528 BOX DRAWINGS VERTICAL HEAVY AND LEFT LIGHT
  ".###." +
  ".###." +
  "####." +
  ".###." +
  ".###.",

  // 0x2529 BOX DRAWINGS DOWN LIGHT AND LEFT UP HEAVY
  ".###." +
  "####." +
  "####." +
  "####." +
  "..#..",

  // 0x252A BOX DRAWINGS UP LIGHT AND LEFT DOWN HEAVY
  "..#.." +
  "####." +
  "####." +
  "####." +
  ".###.",

  // 0x252B BOX DRAWINGS HEAVY VERTICAL AND LEFT
  ".###." +
  "####." +
  "####." +
  "####." +
  ".###.",

  // 0x252C BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
  "....." +
  "....." +
  "#####" +
  "..#.." +
  "..#..",

  // 0x252D BOX DRAWINGS LEFT HEAVY AND RIGHT DOWN LIGHT
  "....." +
  "###.." +
  "#####" +
  "###.." +
  "..#..",

  // 0x252E BOX DRAWINGS RIGHT HEAVY AND LEFT DOWN LIGHT
  "....." +
  "..###" +
  "#####" +
  "..###" +
  "..#..",

  // 0x252F BOX DRAWINGS DOWN LIGHT AND HORIZONTAL HEAVY
  "....." +
  "#####" +
  "#####" +
  "#####" +
  "..#..",

  // 0x2530 BOX DRAWINGS DOWN HEAVY AND HORIZONTAL LIGHT
  "....." +
  "....." +
  "#####" +
  ".###." +
  ".###.",

  // 0x2531 BOX DRAWINGS RIGHT LIGHT AND LEFT DOWN HEAVY
  "....." +
  "####." +
  "#####" +
  "####." +
  ".###.",

  // 0x2532 BOX DRAWINGS LEFT LIGHT AND RIGHT DOWN HEAVY
  "....." +
  ".####" +
  "#####" +
  ".####" +
  ".###.",

  // 0x2533 BOX DRAWINGS HEAVY DOWN AND HORIZONTAL
  "....." +
  "#####" +
  "#####" +
  "#####" +
  ".###.",

  // 0x2534 BOX DRAWINGS LIGHT UP AND HORIZONTAL
  "..#.." +
  "..#.." +
  "#####" +
  "....." +
  ".....",

  // 0x2535 BOX DRAWINGS LEFT HEAVY AND RIGHT UP LIGHT
  "..#.." +
  "###.." +
  "#####" +
  "###.." +
  ".....",

  // 0x2536 BOX DRAWINGS RIGHT HEAVY AND LEFT UP LIGHT
  "..#.." +
  "..###" +
  "#####" +
  "..###" +
  ".....",

  // 0x2537 BOX DRAWINGS UP LIGHT AND HORIZONTAL HEAVY
  "..#.." +
  "#####" +
  "#####" +
  "#####" +
  ".....",

  // 0x2538 BOX DRAWINGS UP HEAVY AND HORIZONTAL LIGHT
  ".###." +
  ".###." +
  "#####" +
  "....." +
  ".....",

  // 0x2539 BOX DRAWINGS RIGHT LIGHT AND LEFT UP HEAVY
  ".###." +
  "####." +
  "#####" +
  "####." +
  ".....",

  // 0x253A BOX DRAWINGS LEFT LIGHT AND RIGHT UP HEAVY
  ".###." +
  ".####" +
  "#####" +
  ".####" +
  ".....",

  // 0x253B BOX DRAWINGS HEAVY UP AND HORIZONTAL
  ".###." +
  "#####" +
  "#####" +
  "#####" +
  ".....",

  // 0x253C BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
  "..#.." +
  "..#.." +
  "#####" +
  "..#.." +
  "..#..",

  // 0x253D BOX DRAWINGS LEFT HEAVY AND RIGHT VERTICAL LIGHT
  "..#.." +
  "###.." +
  "#####" +
  "###.." +
  ".....",

  // 0x253E BOX DRAWINGS RIGHT HEAVY AND LEFT VERTICAL LIGHT
  "..#.." +
  "..###" +
  "#####" +
  "..###" +
  ".....",

  // 0x253F BOX DRAWINGS VERTICAL LIGHT AND HORIZONTAL HEAVY
  "..#.." +
  "#####" +
  "#####" +
  "#####" +
  "..#..",

  // 0x2540 BOX DRAWINGS UP HEAVY AND DOWN HORIZONTAL LIGHT
  ".###." +
  ".###." +
  "#####" +
  "..#.." +
  "..#..",

  // 0x2541  BOX DRAWINGS DOWN HEAVY AND UP HORIZONTAL LIGHT
  "..#.." +
  "..#.." +
  "#####" +
  ".###." +
  ".###.",

  // 0x2542  BOX DRAWINGS VERTICAL HEAVY AND HORIZONTAL LIGHT
  ".###." +
  ".###." +
  "#####" +
  ".###." +
  ".###.",


  // 0x2543  BOX DRAWINGS LEFT UP HEAVY AND RIGHT DOWN LIGHT
  ".###." +
  "####." +
  "#####" +
  "####." +
  "..#..",

  // 0x2544  BOX DRAWINGS RIGHT UP HEAVY AND LEFT DOWN LIGHT
  ".###." +
  ".####" +
  "#####" +
  ".####" +
  "..#..",

  // 0x2545  BOX DRAWINGS LEFT DOWN HEAVY AND RIGHT UP LIGHT
  "..#.." +
  "####." +
  "#####" +
  "####." +
  ".###.",

  // 0x2546  BOX DRAWINGS RIGHT DOWN HEAVY AND LEFT UP LIGHT
  "..#.." +
  ".####" +
  "#####" +
  ".####" +
  ".###.",

  // 0x2547  BOX DRAWINGS DOWN LIGHT AND UP HORIZONTAL HEAVY
  ".###." +
  "#####" +
  "#####" +
  "#####" +
  "..#..",

  // 0x2548  BOX DRAWINGS UP LIGHT AND DOWN HORIZONTAL HEAVY
  "..#.." +
  "#####" +
  "#####" +
  "#####" +
  ".###.",

  // 0x2549  BOX DRAWINGS RIGHT LIGHT AND LEFT VERTICAL HEAVY
  ".###." +
  "####." +
  "#####" +
  "####." +
  ".###.",

  // 0x254A  BOX DRAWINGS LEFT LIGHT AND RIGHT VERTICAL HEAVY
  ".###." +
  ".####" +
  "#####" +
  ".####" +
  ".###.",

  // 0x254B  BOX DRAWINGS HEAVY VERTICAL AND HORIZONTAL
  ".###." +
  "#####" +
  "#####" +
  "#####" +
  ".###.",

  // 0x254C BOX DRAWINGS LIGHT DOUBLE DASH HORIZONTAL
  "....." +
  "....." +
  ".#.#." +
  "....." +
  ".....",

  // 0x254D BOX DRAWINGS HEAVY DOUBLE DASH HORIZONTAL
  "....." +
  ".#.#." +
  ".#.#." +
  ".#.#." +
  ".....",

  // 0x254E BOX DRAWINGS LIGHT DOUBLE DASH VERTICAL
  "....." +
  "..#.." +
  "....." +
  "..#.." +
  ".....",

  // 0x254F BOX DRAWINGS HEAVY DOUBLE DASH VERTICAL
  "....." +
  ".###." +
  "....." +
  ".###." +
  ".....",
  
  // 0x2550 BOX DRAWINGS DOUBLE HORIZONTAL
  "....." +
  "#####" +
  "....." +
  "#####" +
  ".....",

  // 0x2551 BOX DRAWINGS DOUBLE VERTICAL
  ".#.#." +
  ".#.#." +
  ".#.#." +
  ".#.#." +
  ".#.#.",

  // 0x2552 BOX DRAWINGS DOWN SINGLE AND RIGHT DOUBLE
  "....." +
  "..###" +
  "..#.." +
  "..###" +
  "..#..",

  // 0x2553 BOX DRAWINGS DOWN DOUBLE AND RIGHT SINGLE
  "....." +
  "....." +
  ".####" +
  ".#.#." +
  ".#.#.",

  // 0x2554 BOX DRAWINGS DOUBLE DOWN AND RIGHT
  "....." +
  ".####" +
  ".#..." +
  ".#.##" +
  ".#.#.",

  // 0x2555 BOX DRAWINGS DOWN SINGLE AND LEFT DOUBLE
  "....." +
  "###.." +
  "..#.." +
  "###.." +
  "..#..",

  // 0x2556 BOX DRAWINGS DOWN DOUBLE AND LEFTSINGLE
  "....." +
  "....." +
  "####." +
  ".#.#." +
  ".#.#.",

  // 0x2557 BOX DRAWINGS DOUBLE DOWN AND LEFT
  "....." +
  "####." +
  "...#." +
  "##.#." +
  ".#.#.",

  // 0x2558 BOX DRAWINGS UP SINGLE AND RIGHT DOUBLE
  "..#.." +
  "..###" +
  "..#.." +
  "..###" +
  ".....",

  // 0x2559 BOX DRAWINGS UP DOUBLE AND RIGHT SINGLE
  ".#.#." +
  ".#.#." +
  ".####" +
  "....." +
  ".....",

  // 0x255A BOX DRAWINGS DOUBLE UP AND RIGHT
  ".#.#." +
  ".#.##" +
  ".#..." +
  ".####" +
  ".....",
  
  // 0x255B BOX DRAWINGS UP SINGLE AND LEFT DOUBLE
  "..#.." +
  "###.." +
  "..#.." +
  "###.." +
  ".....",
  
  // 0x255C BOX DRAWINGS UP DOUBLE AND LEFT SINGLE
  ".#.#." +
  ".#.#." +
  "####." +
  "....." +
  ".....",
  
  // 0x255D BOX DRAWINGS DOUBLE UP AND LEFT
  ".#.#." +
  "##.#." +
  "...#." +
  "####." +
  ".....",
  
  // 0x255E BOX DRAWINGS VERTICAL SINGLE AND RIGHT DOUBLE
  "..#.." +
  "..###" +
  "..#.." +
  "..###" +
  "..#..",
  
  // 0x255F BOX DRAWINGS VERTICAL DOUBLE AND RIGHT SINGLE
  ".#.#." +
  ".#.#." +
  ".#.##" +
  ".#.#." +
  ".#.#.",
  
  // 0x2560 BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
  ".#.#." +
  ".#.##" +
  ".#..." +
  ".#.##" +
  ".#.#.",
  
  // 0x2561 BOX DRAWINGS VERTICAL SINGLE AND LEFT DOUBLE
  "..#.." +
  "###.." +
  "..#.." +
  "###.." +
  "..#..",
  
  // 0x2562 BOX DRAWINGS VERTICAL DOUBLE AND LEFT SINGLE
  ".#.#." +
  ".#.#." +
  "##.#." +
  ".#.#." +
  ".#.#.",

  // 0x2563 BOX DRAWINGS DOUBLE VERTICAL AND LEFT
  ".#.#." +
  "##.#." +
  "...#." +
  "##.#." +
  ".#.#.",

  // 0x2564 BOX DRAWINGS DOWN SINGLE AND HORIZONTAL DOUBLE
  "....." +
  "#####" +
  "....." +
  "#####" +
  "..#..",
  
  // 0x2565 BOX DRAWINGS DOWN DOUBLE AND HORIZONTAL SINGLE
  "....." +
  "....." +
  "#####" +
  ".#.#." +
  ".#.#.",
  
  // 0x2566 BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
  "....." +
  "#####" +
  "....." +
  "##.##" +
  ".#.#.",
  
  // 0x2567 BOX DRAWINGS UP SINGLE AND HORIZONTAL DOUBLE
  "..#.." +
  "#####" +
  "....." +
  "#####" +
  ".....",
  
  // 0x2568 BOX DRAWINGS UP DOUBLE AND HORIZONTAL SINGLE
  ".#.#." +
  ".#.#." +
  "#####" +
  "....." +
  ".....",

  // 0x2569 BOX DRAWINGS DOUBLE UP AND HORIZONTAL
  ".#.#." +
  "##.##" +
  "....." +
  "#####" +
  ".....",

  // 0x256A BOX DRAWINGS VERTICAL SINGLE AND HORIZONTAL DOUBLE
  "..#.." +
  "#####" +
  "..#.." +
  "#####" +
  "..#..",

  // 0x256B BOX DRAWINGS VERTICAL DOUBLE AND HORIZONTAL SINGLE
  ".#.#." +
  ".#.#." +
  "#####" +
  ".#.#." +
  ".#.#.",

  // 0x256C BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
  ".#.#." +
  "##.##" +
  "....." +
  "##.##" +
  ".#.#.",

  // 0x256D BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
  "....." +
  "....." +
  "...##" +
  "..#.." +
  "..#..",

  // 0x256E BOX DRAWINGS LIGHT ARC DOWN AND LEFT
  "....." +
  "....." +
  "##..." +
  "..#.." +
  "..#..",

  // 0x256F BOX DRAWINGS LIGHT ARC UP AND LEFT
  "..#.." +
  "..#.." +
  "##..." +
  "....." +
  ".....",

  // 0x2570 BOX DRAWINGS LIGHT ARC UP AND RIGHT
  "..#.." +
  "..#.." +
  "...##" +
  "....." +
  ".....",

  // 0x2571 BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
  // TODO use custom code for this.
  "....#" +
  "...#." +
  "..#.." +
  ".#..." +
  "#....",
  
  // 0x2572 BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
  // TODO use custom code for this.
  "#...." +
  ".#..." +
  "..#.." +
  "...#." +
  "....#",

  // 0x2573 BOX DRAWINGS LIGHT DIAGONAL CROSS
  // TODO use custom code for this.
  "#...#" +
  ".#.#." +
  "..#.." +
  ".#.#." +
  "#...#",

  // 0x2574 BOX DRAWINGS LIGHT LEFT
  "....." +
  "....." +
  "###.." +
  "....." +
  ".....",

  // 0x2575 BOX DRAWINGS LIGHT UP
  "..#.." +
  "..#.." +
  "..#.." +
  "....." +
  ".....",

  // 0x2576 BOX DRAWINGS LIGHT RIGHT
  "....." +
  "....." +
  "..###" +
  "....." +
  ".....",

  // 0x2577 BOX DRAWINGS LIGHT DOWN
  "....." +
  "....." +
  "..#.." +
  "..#.." +
  "..#..",

  // 0x2578 BOX DRAWINGS HEAVY LEFT
  "....." +
  "###.." +
  "###.." +
  "###.." +
  ".....",

  // 0x2579 BOX DRAWINGS HEAVY UP
  ".###." +
  ".###." +
  ".###." +
  "....." +
  ".....",

  // 0x257A BOX DRAWINGS HEAVY RIGHT
  "....." +
  "..###" +
  "..###" +
  "..###" +
  ".....",

  // 0x257B BOX DRAWINGS HEAVY DOWN
  "....." +
  "....." +
  ".###." +
  ".###." +
  ".###.",

  // 0x257C  BOX DRAWINGS LIGHT LEFT AND HEAVY RIGHT
  "....." +
  "..###" +
  "#####" +
  "..###" +
  ".....",

  // 0x257D  BOX DRAWINGS LIGHT UP AND HEAVY DOWN
  "..#.." +
  "..#.." +
  ".###." +
  ".###." +
  ".###.",

  // 0x257E  BOX DRAWINGS HEAVY LEFT AND LIGHT RIGHT
  "....." +
  "###.." +
  "#####" +
  "###.." +
  ".....",

  // 0x257F  BOX DRAWINGS HEAVY UP AND LIGHT DOWN
  ".###." +
  ".###." +
  ".###." +
  "..#.." +
  "..#..",
];

export function drawBoxCharacter(ctx: CanvasRenderingContext2D, codePoint: number, dx: number, dy: number,
    width: number, height: number): void {
_log.debug("drawBoxCharacter");

  draw5x5BoxCharacter(ctx, codePoint, dx, dy, width, height);
}

function draw5x5BoxCharacter(ctx: CanvasRenderingContext2D, codePoint: number, dx: number, dy: number,
  width: number, height: number): void {

  // Our box glyphs are on a 5x5 grid where the pixels which touch the edges must be rendered twice
  // the size of the pixels which make up the center. Also we want the glyph pixels to be rendered
  // with consistent integer dimensions, and any extra space is distributed to the edge pixels.

  const hThickness = Math.floor(width / 7);
  const vThickness = Math.floor(height / 7);

  const topRowThickness = Math.ceil((height - 3 * vThickness) / 2);
  const bottomRowThickness = height - 3 * vThickness - topRowThickness;

  const leftColumnThickness = Math.ceil((width - 3 * hThickness) / 2);
  const rightColumnThickness = width - 3 * hThickness - leftColumnThickness;

  const glyphString = boxGlyphs5x5[codePoint - FIRST_BOX_CODE_POINT];

  const horizontalThickness = new Array(GRID_WIDTH);
  horizontalThickness[0] = leftColumnThickness;
  for (let i=1; i<GRID_WIDTH-1; i++) {
    horizontalThickness[i] = hThickness;
  }
  horizontalThickness[GRID_WIDTH-1] = rightColumnThickness;

  const horizontalGridLines = new Array(GRID_WIDTH);
  for (let accu=0, i=0; i<GRID_WIDTH; i++) {
    horizontalGridLines[i] = accu;
    accu += horizontalThickness[i];
  }

  const verticalThickness = new Array(GRID_HEIGHT);
  verticalThickness[0] = topRowThickness;
  for (let i=1; i<GRID_HEIGHT-1; i++) {
    verticalThickness[i] = vThickness;
  }
  verticalThickness[GRID_HEIGHT-1] = bottomRowThickness;

  const verticalGridLines = new Array(GRID_HEIGHT);
  for (let accu=0, i=0; i<GRID_HEIGHT; i++) {
    verticalGridLines[i] = accu;
    accu += verticalThickness[i];
  }

  let pixelOffset = 0;
  for (let y=0; y<GRID_HEIGHT; y++) {
    for (let x=0; x<GRID_WIDTH; x++) {
      if (glyphString.charAt(pixelOffset) === "#") {
        ctx.fillRect(dx + horizontalGridLines[x], dy+verticalGridLines[y], horizontalThickness[x], verticalThickness[y]);
      }
      pixelOffset++;
    }
  }
}
