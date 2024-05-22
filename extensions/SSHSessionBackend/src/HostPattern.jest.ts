/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { HostPattern } from "./HostPattern";

test("plain IP", done => {
  const pattern = new HostPattern("192.168.1.1");
  expect(pattern.isNegative()).toBe(false);
  expect(pattern.match("192.168.1.1")).toBe(true);
  done();
});

test("negate IP", done => {
  const pattern = new HostPattern("!192.168.1.1");
  expect(pattern.isNegative()).toBe(true);
  expect(pattern.match("192.168.1.1")).toBe(true);
  done();
});

test("domain", done => {
  const pattern = new HostPattern("*.example.com");
  expect(pattern.isNegative()).toBe(false);

  expect(pattern.match("server.example.com")).toBe(true);

  expect(pattern.match("server.example.com.au")).toBe(false);
  done();
});

test("any domain", done => {
  const pattern = new HostPattern("*");
  expect(pattern.isNegative()).toBe(false);

  expect(pattern.match("server.example.com")).toBe(true);
  expect(pattern.match("192.168.1.1")).toBe(true);
  expect(pattern.match("server.example.com.au")).toBe(true);
  done();
});

test("domain with ?", done => {
  const pattern = new HostPattern("server?.example.com");
  expect(pattern.isNegative()).toBe(false);

  expect(pattern.match("server1.example.com")).toBe(true);
  expect(pattern.match("server2.example.com")).toBe(true);

  expect(pattern.match("server.example.com.au")).toBe(false);
  expect(pattern.match("server123.example.com.au")).toBe(false);
  done();
});

test("domain with multiple *", done => {
  const pattern = new HostPattern("*.example.com.*");
  expect(pattern.isNegative()).toBe(false);

  expect(pattern.match("server.example.com.au")).toBe(true);

  expect(pattern.match("server.example.com")).toBe(false);
  done();
});

test("Escape dots", done => {
  const pattern = new HostPattern(".......example.com");
  expect(pattern.isNegative()).toBe(false);

  expect(pattern.match("server.example.com")).toBe(false);
  done();
});
