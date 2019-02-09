/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const parser = require("../parser").parser;

test("bare symbol", () => {
  const tree  = parser.parse("ASymbol");
  expect(tree.type).toBe("symbol");
  expect(tree.name).toBe("ASymbol");
});

test("bare symbol with whitespace", () => {
  const tree  = parser.parse("  ASymbol   ");
  expect(tree.type).toBe("symbol");
  expect(tree.name).toBe("ASymbol");
});

test("OR", () => {
  const tree  = parser.parse("A || B");
  expect(tree.type).toBe("||");
  expect(tree.left.type).toBe("symbol");
  expect(tree.left.name).toBe("A");
  expect(tree.right.type).toBe("symbol");
  expect(tree.right.name).toBe("B");
});

test("AND", () => {
  const tree  = parser.parse("A && B");
  expect(tree.type).toBe("&&");
  expect(tree.left.type).toBe("symbol");
  expect(tree.left.name).toBe("A");
  expect(tree.right.type).toBe("symbol");
  expect(tree.right.name).toBe("B");
});

test("brackets", () => {
  const tree  = parser.parse("(A)");
  expect(tree.type).toBe("brackets");
  expect(tree.operand.type).toBe("symbol");
  expect(tree.operand.name).toBe("A");
});

test("brackets 2", () => {
  const tree  = parser.parse("(A && B)");
  expect(tree.type).toBe("brackets");
  expect(tree.operand.type).toBe("&&");
  expect(tree.operand.left.type).toBe("symbol");
  expect(tree.operand.right.type).toBe("symbol");
});

test("brackets 3", () => {
  const tree  = parser.parse("B && (A)");
  expect(tree.type).toBe("&&");
  expect(tree.left.type).toBe("symbol");
  expect(tree.right.type).toBe("brackets");
});

test("NOT", () => {
  const tree  = parser.parse("!A");
  expect(tree.type).toBe("!");
  expect(tree.operand.type).toBe("symbol");
  expect(tree.operand.name).toBe("A");
});

test("precedence &&", () => {
  const tree  = parser.parse("A || B && C");
  expect(tree.type).toBe("||");
  expect(tree.left.type).toBe("symbol");
  expect(tree.left.name).toBe("A");

  expect(tree.right.type).toBe("&&");
});

test("precedence && 2", () => {
  const tree  = parser.parse("A && B || C");
  expect(tree.type).toBe("||");
  expect(tree.left.type).toBe("&&");
  expect(tree.right.type).toBe("symbol");
  expect(tree.right.name).toBe("C");
});

test("precedence NOT", () => {
  const tree  = parser.parse("!A && B");
  expect(tree.type).toBe("&&");
  expect(tree.left.type).toBe("!");
  expect(tree.right.type).toBe("symbol");
});
