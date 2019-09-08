/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import * as SourceMapSupport from 'source-map-support';

import { MouseEncoder } from './MouseEncoder';
import { TerminalCoord, MouseEventOptions } from 'term-api';

function emptyEvent(): MouseEventOptions {
  return {
    row: 1,
    column: 1,
    leftButton: false,
    middleButton: false,
    rightButton: false,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
  };
}

test("no mouse events", done => {
  const mouseEncoder = new MouseEncoder();

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true } )).toBe(null);
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true } )).toBe(null);
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true } )).toBe(null);

  done();
});

test("normal mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[M &#");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 3, column: 5 } )).toBe("\u001b[M@&$");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[M#&#");

  done();
});

test("normal mouse mods", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), rightButton: true, shiftKey: true, row: 2, column: 5 } )).toBe("\u001b[M2&#");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), rightButton: true, shiftKey: true, row: 2, column: 5 } )).toBe("\u001b[M3&#");

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, rightButton: true, shiftKey: true, ctrlKey: true, row: 2, column: 5 } )).toBe("\u001b[Mp&#");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, rightButton: true, shiftKey: true, ctrlKey: true, row: 2, column: 5 } )).toBe("\u001b[Ms&#");

  expect(mouseEncoder.mouseDown( {...emptyEvent(), middleButton: true, metaKey: true, row: 2, column: 5 } )).toBe("\u001b[MA&#");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), middleButton: true, row: 2, column: 5 } )).toBe("\u001b[M#&#");

  done();
});

test("x10 mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.x10Mouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[M &#");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 3, column: 5 } )).toBe(null);
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe(null);

  done();
});

test("vt220 mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.vt200Mouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[M &#\u001b[M#&#");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 3, column: 5 } )).toBe(null);
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe(null);

  done();
});

test("sgr mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.sgrMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[<0;6;3M");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 3, column: 5 } )).toBe("\u001b[<32;6;4M");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[<0;6;3m");

  done();
});

test("urxvt mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.urxvtMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[32;6;3M");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 3, column: 5 } )).toBe("\u001b[64;6;4M");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 2, column: 5 } )).toBe("\u001b[35;6;3M");

  done();
});

test("utf8 mouse", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.utfMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.mouseDown( {...emptyEvent(), leftButton: true, row: 125, column: 258 } )).toBe("\u001b[M Ä£Â");
  expect(mouseEncoder.mouseMove( {...emptyEvent(), leftButton: true, row: 126, column: 258 } )).toBe("\u001b[M@Ä£Â");
  expect(mouseEncoder.mouseUp( {...emptyEvent(), leftButton: true, row: 127, column: 258 } )).toBe("\u001b[M#Ä£Â ");

  done();
});

test("sgr mouse wheel", done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.normalMouse = true;
  mouseEncoder.sgrMouse = true;
  mouseEncoder.mouseEvents = true;

  expect(mouseEncoder.wheelUp( {...emptyEvent(), row: 2, column: 5 } )).toBe("\u001b[<64;6;3M");
  expect(mouseEncoder.wheelDown( {...emptyEvent(), row: 2, column: 5 } )).toBe("\u001b[<65;6;3M");

  done();
});

test("send wheel cursor keys",  done => {
  const mouseEncoder = new MouseEncoder();
  mouseEncoder.sendCursorKeysForWheel = true;
  mouseEncoder.wheelCursorKeyAcceleration = 2;

  expect(mouseEncoder.wheelUp( {...emptyEvent(), row: 2, column: 5 } )).toBe("\u001bOA\u001bOA");
  expect(mouseEncoder.wheelDown( {...emptyEvent(), row: 2, column: 5 } )).toBe("\u001bOB\u001bOB");

  done();
});
