/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import {Emulator, RenderEvent, Line} from './Term';
const performanceNow = require('performance-now');

export async function testBasic(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({performanceNowFunc: performanceNow});
  emulator.write('Hello');

  await waitOnEmulator(emulator);

  test.equals(emulator.getLineText(0).trim(), 'Hello');
  test.done();
}

export async function testWrap(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});
  emulator.write('abcdefghijklmnopqrstuvwxyz');

  await waitOnEmulator(emulator);

  test.equals(emulator.getLineText(0).trim(), 'abcdefghijklmnopqrst');
  test.equals(emulator.getLineText(1).trim(), 'uvwxyz');
  test.done();
}

export async function testScrollOne(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});

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
  
  test.equals(emulator.getLineText(0).trim(), '2');
  test.done();
}

export async function testRenderDevice(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});
  const device = new RenderDevice();
  emulator.addRenderEventListener(device.renderEventListener.bind(device));

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

  test.equals(readEmulatorScreenString(emulator), device.getScreenString());
  test.done();
}

export async function testMoveCursor(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});
  const device = new RenderDevice();
  emulator.addRenderEventListener(device.renderEventListener.bind(device));
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

  test.equals(lineToString(emulator.lineAtRow(4)).trim(), '#');
  test.done();
}

export async function testMoveRowsAboveCursorToScrollback(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});
  const device = new RenderDevice();
  emulator.addRenderEventListener(device.renderEventListener.bind(device));
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

  // test.equals(lineToString(emulator.lineAtRow(4)).trim(), '#');
  test.done();
}


function waitOnEmulator(emulator: Emulator): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
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

  renderEventListener(instance: Emulator, event: RenderEvent): void {
    if (event.refreshStartRow !== -1) {
      for (let row=event.refreshStartRow; row < event.refreshEndRow; row++) {
        const line = instance.lineAtRow(row);
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
  const lineWithCursor = line.chars.map((c, index) => line.attrs[index] === 0xffffffff ? '#'.codePointAt(0) : c);
  return String.fromCodePoint(...lineWithCursor);
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
