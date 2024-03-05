/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { performance } from "node:perf_hooks";
import {Emulator, MAX_WRITE_BUFFER_SIZE, Platform} from "./Term.js";
import {RenderEvent, Line, MinimalKeyboardEvent, DataEvent} from "term-api";
import { STYLE_MASK_CURSOR } from "extraterm-char-cell-line";
import fs from "node:fs";


test("basic", done => {
  async function testBasic(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform,
      performanceNowFunc: () => performance.now()});
    emulator.write('Hello');

    await waitOnEmulator(emulator);

    expect(emulator.getLineText(0).trim()).toBe('Hello');
    done();
  }

  testBasic();
});

test("wrap", done => {
  async function testWrap(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    emulator.write('abcdefghijklmnopqrstuvwxyz');

    await waitOnEmulator(emulator);

    expect(emulator.getLineText(0).trim()).toBe('abcdefghijklmnopqrst');
    expect(emulator.getLineText(1).trim()).toBe('uvwxyz');
    done();
  }
  testWrap();
});

test("scroll one", done => {
  async function testScrollOne(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});

    emulator.write('1\n');
    emulator.write('2\n');
    emulator.write('3\n');
    emulator.write('4\n');
    emulator.write('5\n');
    emulator.write('6\n');
    emulator.write('7\n');
    emulator.write('8\n');
    emulator.write('9\n');
    emulator.write('10\n');
    emulator.write('11');

    await waitOnEmulator(emulator);

    expect(emulator.getLineText(0).trim()).toBe('2');
    done();
  }
  testScrollOne();
});

test("render device", done => {
  async function testRenderDevice(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    const device = new RenderDevice();
    emulator.onRender(device.renderEventHandler.bind(device));

    emulator.write('1\r\n');
    emulator.write('2\r\n');
    emulator.write('3\r\n');
    emulator.write('4\r\n');
    emulator.write('5\r\n');
    emulator.write('6\r\n');
    emulator.write('7\r\n');
    emulator.write('8\r\n');
    emulator.write('9\r\n');
    emulator.write('10');

    await waitOnEmulator(emulator);

    expect(readEmulatorScreenString(emulator)).toBe(device.getScreenString());
    done();
  }
  testRenderDevice();
});

test("move cursor", done => {
  async function testMoveCursor(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    const device = new RenderDevice();
    emulator.onRender(device.renderEventHandler.bind(device));
    emulator.write('1\r\n');
    emulator.write('2\r\n');
    emulator.write('3\r\n');
    emulator.write('4\r\n');
    emulator.write('5\r\n');
    emulator.write('6\r\n');
    emulator.write('7\r\n');
    emulator.write('8\r\n');
    emulator.write('9\r\n');
    emulator.write('10');
    emulator.write('\x1b[5;1H');
    await waitOnEmulator(emulator);

    expect(lineToString(emulator.lineAtRow(4)).trim()).toBe('#');
    done();
  }
  testMoveCursor();
});

describe.each([
  ["One write", ['\uD801\uDC37\r\n']],
  ["Split write", ['\uD801', '\uDC37\r\n']]
])("UTF-16 surrogate handling", (name, dataList) => {

  test(`UTF-16 surrogate handling: ${name}`, done => {
    async function testSurrogateHandling(): Promise<void> {
      const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
        performanceNowFunc: () => performance.now()});
      const device = new RenderDevice();
      emulator.onRender(device.renderEventHandler.bind(device));

      for (const data of dataList) {
        emulator.write(data);
      }
      await waitOnEmulator(emulator);

      const row = emulator.lineAtRow(0);
      expect(row.getCodePoint(0)).toBe(0x10437);
      expect(lineToString(row).trim()).toBe('\uD801\uDC37');
      done();
    }
    testSurrogateHandling();
  });
});

test("Move rows above cursor to scrollback", done => {
  async function testMoveRowsAboveCursorToScrollback(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    const device = new RenderDevice();
    emulator.onRender(device.renderEventHandler.bind(device));
    emulator.write('1\r\n');
    emulator.write('2\r\n');
    emulator.write('3\r\n');
    emulator.write('4\r\n');
    emulator.write('5\r\n');
    emulator.write('6\r\n');
    emulator.write('7\r\n');
    emulator.write('8\r\n');
    emulator.write('9\r\n');
    emulator.write('10');
    emulator.write('\x1b[5;1H');
    await waitOnEmulator(emulator);

    emulator.moveRowsAboveCursorToScrollback();

    await waitOnEmulator(emulator);

  // console.log("Emulator");
  // console.log(`x: ${emulator.x}, y: ${emulator.y}`);
  // console.log(formatRectString(readEmulatorScreenString(emulator)));

  // console.log("Device");
  // console.log(formatRectString(device.getScrollbackString()));
  // console.log(formatRectString(device.getScreenString()));

    done();
  }
  testMoveRowsAboveCursorToScrollback();
});

test("hyperlink", done => {
  async function testHyperlink(): Promise<void> {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    const device = new RenderDevice();
    emulator.onRender(device.renderEventHandler.bind(device));
    emulator.write('\x1b]8;;https://extraterm.org\x07Extraterm\r\n');
    await waitOnEmulator(emulator);

    const row = emulator.lineAtRow(0);
    expect(lineToString(row).trim()).toBe('Extraterm');
    expect(row.getCell(0).linkID).not.toBe(0);
    expect(row.getAllLinkIDs("").length).toBe(1);

    done();
  }
  testHyperlink();
});

describe.each([
  [{key: "a", altKey: false, ctrlKey: false, isComposing: false, metaKey: false, shiftKey: false}, "a"],
])("Keyboard input keyPress()", (ev: MinimalKeyboardEvent, output: string) => {

  test(`${JSON.stringify(ev)} => ${JSON.stringify(output)}`, done => {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now()});
    let collectedData = "";
    emulator.onData( (event: DataEvent): void => {
      collectedData = collectedData + event.data;
    });

    emulator.keyDown(ev);
    expect(collectedData).toBe(output);

    done();
  });
});

describe.each([
  [{key: "d", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x04"],

  [{key: "2", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x00"],
  [{key: "`", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x00"],

  [{key: "[", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1b"],
  [{key: "3", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1b"],

  [{key: "4", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1c"],
  [{key: "\\", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1c"],
  [{key: "|", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: true}, "\x1c"],

  [{key: "]", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1d"],
  [{key: "5", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1d"],

  // RS char
  [{key: "6", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1e"],
  [{key: "^", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: true}, "\x1e"],
  [{key: "~", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: true}, "\x1e"],

  [{key: "_", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x1f"],
  [{key: "?", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: true}, "\x1f"],
  [{key: "8", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\xf7"],

  [{key: "Backspace", altKey: false, ctrlKey: false, isComposing: false, metaKey: false, shiftKey: false}, "\x7f"],
  [{key: "Backspace", altKey: false, ctrlKey: false, isComposing: false, metaKey: false, shiftKey: true}, "\x7f"],
  [{key: "Backspace", altKey: false, ctrlKey: true, isComposing: false, metaKey: false, shiftKey: false}, "\x08"],
  [{key: "Backspace", altKey: true, ctrlKey: false, isComposing: false, metaKey: true, shiftKey: false}, "\x1b\x7f"],

])("Keyboard input keyDown()", (ev: MinimalKeyboardEvent, output: string) => {

  test(`${JSON.stringify(ev)} => ${JSON.stringify(output)}`, done => {
    const emulator = new Emulator({platform: <Platform> process.platform, rows: 10, columns: 20,
      performanceNowFunc: () => performance.now() });
    let collectedData = "";
    emulator.onData( (event: DataEvent): void => {
      collectedData = collectedData + event.data;
    });

    emulator.keyDown(ev);
    expect(collectedData).toBe(output);

    done();
  });
});

function waitOnEmulator(emulator: Emulator): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
}

async function waitOnEmulator(emulator: Emulator): Promise<void> {
  let done = false;
  if (emulator.getWriteBufferStatus().bufferSize === MAX_WRITE_BUFFER_SIZE) {
    return;
  }
  emulator.onWriteBufferSize((e) => {
    if (e.status.bufferSize === MAX_WRITE_BUFFER_SIZE) {
      done = true;
    }
  });

  while (! done) {
    await sleep(100);
  }
}

function readEmulatorScreenString(emulator: Emulator): string {
  let result = lineToString(emulator.lineAtRow(0));
  let row = 1;

  while (true) {
    const line = emulator.lineAtRow(row);
    if (line == null) {
      break;
    }
    result += '\n' + lineToString(line);
    row++;
  }

  return result;
}

class RenderDevice {
  scrollback: string[] = [];
  screen: string[] = [];

  renderEventHandler(event: RenderEvent): void {
    if (event.refreshStartRow !== -1) {
      for (let row=event.refreshStartRow; row < event.refreshEndRow; row++) {
        const line = event.instance.lineAtRow(row);
        this.screen[row] = lineToString(line);
      }
    }

    if (event.realizedRows < this.screen.length) {
      this.screen = this.screen.slice(0, event.realizedRows);
    }

    event.scrollbackLines.forEach(line => this.scrollback.push(lineToString(line)));
  }

  getScreenString(): string {
    return this.screen.join('\n');
  }

  getScrollbackString(): string {
    return this.scrollback.join('\n');
  }
}

function lineToString(line: Line): string {
  const codePoints = [];
  for (let i=0; i<line.width; i++) {
    if (line.getStyle(i) & STYLE_MASK_CURSOR) {
      codePoints.push("#".codePointAt(0));
    } else {
      codePoints.push(line.getCodePoint(i));
    }
  }
  return String.fromCodePoint(...codePoints);
}

function formatRectString(str: string): string {
  const lines = str.split(/\n/g);
  const linesLength = Math.max(...lines.map(lines => lines.length));
  const topBottom = '   +' + '-'.repeat(linesLength) + '+\n';

  const body = lines.map((line, index) => leftPad("" + index, 3) + '|' + line + '|').join('\n');

  return topBottom + body + '\n' + topBottom;
}

function leftPad(str, count): string {
  return ' '.repeat(count-str.length) + str;
}
