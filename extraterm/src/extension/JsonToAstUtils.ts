/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { JsonNode, JsonObject } from "json-to-ast";

export class JsonError {
  constructor(public readonly msg: string, public readonly node: JsonNode) {
  }
}

export function throwJsonError(msg: string, node: JsonNode): never {
  throw new JsonError(msg, node);
}

export function assertIsJsonObject(json: JsonNode): JsonObject {
  if (json.type === "Object") {
    return json;
  }
  return throwJsonError("Expected an object.", json);
}

export function assertKnownJsonObjectKeys(jsonNode: JsonNode, knownKeys: string[]): void {
  const jsonObject = assertIsJsonObject(jsonNode);
  for (const key of jsonObject.children) {
    if (knownKeys.indexOf(<any> key.key.value) === -1) {
      const formattedKeys = knownKeys.join("', '");
      return throwJsonError(`Unknown property '${key.key.value}'. Expected one of '${formattedKeys}'.`, key);
    }
  }
}

export function getJsonProperty(json: JsonObject, name: string): JsonNode {
  for (const prop of json.children) {
    if (name === prop.key.value) {
      return prop.value;
    }
  }
  return undefined;
}

export function parseObjectListJson<T>(packageJson: JsonNode, fieldName: string, objectParser: (node: JsonNode) => T): T[] {
  const jsonObject = assertIsJsonObject(packageJson);
  const value = getJsonProperty(jsonObject, fieldName);
  if (value == null) {
    return [];
  }

  if (value.type === "Array") {
    const result: T[] = [];
    for (const item of value.children) {
      result.push(objectParser(item));
    }
    return result;
  }
  return throwJsonError(`Field '${fieldName}' is not an array.`, value);
}

export function getJsonStringField(packageJson: JsonNode, fieldName: string, defaultValue: string=undefined): string {
  const jsonObject = assertIsJsonObject(packageJson);
  const value = getJsonProperty(jsonObject, fieldName);
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
  }

  if (value.type === "Literal") {
    if(typeof value.value === "string") {
      return value.value;
    }
  }
  return throwJsonError(`Field '${fieldName}' is not a string.`, value);
}

export function getJsonNumberField(packageJson: JsonNode, fieldName: string, defaultValue: number=1000000): number {
  const jsonObject = assertIsJsonObject(packageJson);
  const value = getJsonProperty(jsonObject, fieldName);
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
  }

  if (value.type === "Literal") {
    if (typeof value.value === "number") {
      return value.value;
    }
  }    
  return throwJsonError(`Field '${fieldName}' is not a number.`, value);
}

export function getJsonBooleanField(packageJson: JsonNode, fieldName: string, defaultValue: boolean): boolean {
  const jsonObject = assertIsJsonObject(packageJson);
  const value = getJsonProperty(jsonObject, fieldName);
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return throwJsonError(`Field '${fieldName}' is missing.`, jsonObject);
  }

  if (value.type === "Literal") {
    if (typeof value.value === "boolean") {
      return value.value;
    }
  }    
  return throwJsonError(`Field '${fieldName}' is not a boolean.`, value);
}

export function getJsonStringArrayField(packageJson: JsonNode, fieldName: string, defaultValue: string[]=undefined): string[] {
  const jsonObject = assertIsJsonObject(packageJson);
  const value = getJsonProperty(jsonObject, fieldName);
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return throwJsonError(`Field '${fieldName}' is missing.`, packageJson);
  }

  if (value.type === "Array") {
    const result: string[] = [];
    for (let i=0; i < value.children.length; i++) {
      const kid = value.children[i];
      if (kid.type !== "Literal" || typeof kid.value !== "string") {
        return throwJsonError(`Item of field '${fieldName}' is not a string.`, kid);
      }
      result.push(kid.value);
    }
    return result;
  }

  return throwJsonError(`Field '${fieldName}' is not an array.`, value);
}

