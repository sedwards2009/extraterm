/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Type definitions for json-to-ast https://github.com/vtrushin/json-to-ast

export = parse;

declare function parse(jsonString: string, settings?: parse.Settings): parse.JsonNode;

declare namespace parse {
  
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
