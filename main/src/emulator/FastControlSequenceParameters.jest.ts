/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ControlSequenceParameters } from "./FastControlSequenceParameters.js";

test("prefix", () => {
  const params = new ControlSequenceParameters();
  params.appendPrefix("X".codePointAt(0));
  expect(params.hasPrefix()).toBe(true);
  expect(params.getPrefixLength()).toEqual(1);
  expect(params.getPrefixString()).toEqual("X");

  params.reset();
  expect(params.hasPrefix()).toBe(false);
});

test("prefix 2", () => {
  const params = new ControlSequenceParameters();
  params.appendPrefix("X".codePointAt(0));
  params.appendPrefix("Y".codePointAt(0));
  expect(params.getPrefixLength()).toEqual(2);
  expect(params.getPrefixString()).toEqual("XY");

  params.reset();
  expect(params.hasPrefix()).toBe(false);
});

test("param", () => {
  const params = new ControlSequenceParameters();

  params.appendParameterCodePoint("X".codePointAt(0));
  params.endParameter();
  expect(params.getParamCount()).toBe(1);

  params.appendParameterCodePoint("X".codePointAt(0));
  params.appendParameterCodePoint("Y".codePointAt(0));
  params.endParameter();
  expect(params.getParamCount()).toBe(2);

  expect(params.getParameterString(0)).toEqual("X");
  expect(params.getParameterString(1)).toEqual("XY");

  params.reset();
});

test("param int", () => {
  const params = new ControlSequenceParameters();

  params.appendParameterCodePoint("1".codePointAt(0));
  params.endParameter();
  expect(params.getParamCount()).toBe(1);

  params.appendParameterCodePoint("2".codePointAt(0));
  params.appendParameterCodePoint("3".codePointAt(0));
  params.endParameter();
  expect(params.getParamCount()).toBe(2);

  expect(params.getParameterInt(0)).toBe(1);
  expect(params.getParameterInt(1)).toBe(23);

  params.reset();
});

test("param expand", () => {
  const params = new ControlSequenceParameters();

  params.appendParameterCodePoint("X".codePointAt(0));
  params.appendParameterCodePoint(":".codePointAt(0));
  params.appendParameterCodePoint("Y".codePointAt(0));
  params.endParameter();

  expect(params.getParamCount()).toBe(1);

  const split = params.getExpandParameter(0, ":".codePointAt(0));

  expect(split.getParamCount()).toBe(2);

  expect(split.getParameterString(0)).toEqual("X");
  expect(split.getParameterString(1).length).toBe(1);
  expect(split.getParameterString(1)).toEqual("Y");

  params.reset();
});
