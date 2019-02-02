/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Symbol {
  type: "symbol";
  name: string;
}

export interface And {
  type: "&&";
  left: AST;
  right: AST;
}

export interface Or {
  type: "||";
  left: AST;
  right: AST;
}

export interface Not {
  type: "!";
  operand: AST;
}

export interface Brackets {
  type: "brackets";
  operand: AST;
}

export type AST = Symbol | And | Or | Not | Brackets;

export declare namespace parser {
  function parse(input: string): AST;
}
