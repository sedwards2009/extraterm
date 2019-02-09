/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { parser, AST } from "extraterm-boolean-expression-parser";


export class BooleanExpressionEvaluator {

  private _resultCache = new Map<string, boolean>();

  constructor(private _values: object) {
  }

  evaluate(input: string): boolean {
    if (this._resultCache.has(input)) {
      return this._resultCache.get(input);
    }
    const ast = parser.parse(input);
    const result = this._evaluateTree(ast);
    this._resultCache.set(input, result);
    return result;
  }

  private _evaluateTree(ast: AST): boolean {
    switch (ast.type) {
      case "symbol": {
          const value =  this._values[ast.name];
          if (value === undefined) {
            throw Error("Undefined value '${ast.name}'");
          }
          return value;
        }
      case "||":
        return this._evaluateTree(ast.left) || this._evaluateTree(ast.right);
      case "&&":
        return this._evaluateTree(ast.left) && this._evaluateTree(ast.right);
      case "!":
        return ! this._evaluateTree(ast.operand);
      case "brackets":
        return this._evaluateTree(ast.operand);
    }
  }
}
