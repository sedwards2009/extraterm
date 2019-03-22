/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Type definitions for json-to-ast https://github.com/vtrushin/json-to-ast

// declare var json_to_ast: json_to_ast.parse;
// export = json_to_ast;
export = parse;

declare function parse(jsonString: string, settings?: parse.Settings): parse.JsonNode;

// export default function parse(jsonString: string, settings?: json_to_ast.Settings): json_to_ast.JsonNode;

declare namespace parse {

  // interface parse {
  //   (jsonString: string, settings?: json_to_ast.Settings): json_to_ast.JsonNode;
  // }
  
  export interface Settings {
    loc?: boolean;
    source?: string;
  }

  export interface CharPosition {
    line: number;
    column: number;
    offset: number;
  }

  export interface Location {
    start: CharPosition;
    end: CharPosition;
    source: string;
  }

  export type JsonNode = JsonObject | JsonArray | JsonLiteral | JsonProperty | JsonIdentifier;

  export interface JsonObject {
    type: "Object";
    children: JsonProperty[];
    loc?: Location;
  }

  export interface JsonArray {
    type: "Array";
    children: (JsonObject | JsonArray | JsonLiteral)[];
    loc?: Location;
  }

  export interface JsonLiteral {
    type: "Literal";
    value: string | number | boolean | null;
    raw: string;
    loc?: Location;
  }

  export interface JsonProperty {
    type: "Property";
    key: JsonIdentifier;
    value: JsonObject | JsonArray | JsonLiteral;
    loc?: Location;
  }

  export interface JsonIdentifier {
    type: "Identifier";
    value: string;
    raw: string;
    loc?: Location;
  }
}
