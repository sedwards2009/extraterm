  /*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContributions, ExtensionMetadata, ExtensionViewerContribution } from "../../ExtensionMetadata";


export function parsePackageJson(packageJson: any, extensionPath: string): ExtensionMetadata {
  const result: ExtensionMetadata = {
    name: assertJsonStringField(packageJson, "name"),
    path: extensionPath,
    main: assertJsonStringField(packageJson, "main", "main.js"),
    version: assertJsonStringField(packageJson, "version"),
    description: assertJsonStringField(packageJson, "description"),
    contributions: parseContributionsJson(packageJson)
  };
  return result;
}

function assertJsonStringField(packageJson: any, fieldName: string, defaultValue: string=undefined): string {
  const value = packageJson[fieldName];
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw `Field '${fieldName}' is missing.`;
  }

  if (typeof value !== "string") {
    throw `Field '${fieldName}' is not a string.`;
  }
  return value;
}

function assertJsonStringArrayField(packageJson: any, fieldName: string, defaultValue: string[]=undefined): string[] {
  const value = packageJson[fieldName];
  if (value == null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw `Field '${fieldName}' is missing.`;
  }

  if ( ! Array.isArray(value)) {
    throw `Field '${fieldName}' is not an array.`;
  }

  for (let i=0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw `Item ${i+1} of field '${fieldName}' is not a string.`;
    }
  }

  return value;
}

function parseContributionsJson(packageJson: any): ExtensionContributions {
  if (packageJson["contributions"] == null) {
    return {
      viewer: []
    };
  }

  if (typeof packageJson["contributions"] !== "object") {
    throw `'contributions' field is not an object.`;
  }

  return {
    viewer: parseViewerContributionsListJson(packageJson["contributions"])
  };
}

function parseViewerContributionsListJson(packageJson: any): ExtensionViewerContribution[] {
  const value = packageJson["viewer"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'viewers' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionViewerContribution[] = [];
  for (const item of value) {
    result.push(parseViewerConstributionJson(item));
  }
  return result;
}

function parseViewerConstributionJson(packageJson: any): ExtensionViewerContribution {
  try {
    return {
      name: assertJsonStringField(packageJson, "name"),
      mimeTypes: assertJsonStringArrayField(packageJson, "mimeTypes")
    };
  } catch (ex) {
    throw `Failed to process a viewer contribution: ${ex}`;
  }
}
