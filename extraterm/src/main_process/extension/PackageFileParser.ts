  /*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContributions, ExtensionMetadata, ExtensionViewerContribution, ExtensionCss, ExtensionSessionEditorContribution, ExtensionSessionBackendContribution, ExtensionPlatform, ExtensionSyntaxThemeProviderContribution, ExtensionSyntaxThemeContribution, ExtensionTerminalThemeProviderContribution, ExtensionTerminalThemeContribution } from "../../ExtensionMetadata";

const FONT_AWESOME_DEFAULT = false;


export function parsePackageJson(packageJson: any, extensionPath: string): ExtensionMetadata {
  const result: ExtensionMetadata = {
    name: assertJsonStringField(packageJson, "name"),
    path: extensionPath,
    main: assertJsonStringField(packageJson, "main", "main.js"),
    version: assertJsonStringField(packageJson, "version"),
    includePlatform: parsePlatformsJson(packageJson, "includePlatform"),
    excludePlatform: parsePlatformsJson(packageJson, "excludePlatform"),
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

function assertJsonBooleanField(packageJson: any, fieldName: string, defaultValue: boolean): boolean {
  const value = packageJson[fieldName];
  if (value == null) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw `Field '${fieldName}' is not a boolean.`;
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

function parsePlatformsJson(packageJson: any, fieldName: string): ExtensionPlatform[] {
  const value = packageJson[fieldName];
  if (value == null) {
    return [];
  }

  if ( ! Array.isArray(value)) {
    throw `Field '${fieldName}' is not an array.`;
  }

  const result = [];
  for (let i=0; i < value.length; i++) {
    result.push(parsePlatformJson(value[i]))
  }
  return result;
}

function parsePlatformJson(packageJson: any): ExtensionPlatform {
  try {
    return {
      os: assertJsonStringField(packageJson, "os", null),
      arch: assertJsonStringField(packageJson, "arch", null)
    };
  } catch (ex) {
    throw `Failed to process a platform specification: ${ex}`;
  }
}

function parseContributionsJson(packageJson: any): ExtensionContributions {
  const contributions = packageJson["contributions"];
  if (contributions == null) {
    return {
      viewer: [],
      sessionEditor: [],
      sessionBackend: [],
      syntaxTheme: [],
      syntaxThemeProvider: [],
      terminalTheme: [],
      terminalThemeProvider: [],
    };
  }

  if (typeof contributions !== "object") {
    throw `'contributions' field is not an object.`;
  }

  const knownContributions = ["viewer", "sessionEditor", "sessionBackend", "syntaxTheme", "syntaxThemeProvider", "terminalTheme", "terminalThemeProvider"];
  for (const key in contributions) {
    if (contributions.hasOwnProperty(key)) {
      if (knownContributions.indexOf(key) === -1) {
        throw `'contributions' contains an unknown property '${key}'`;
      }
    }
  }

  return {
    viewer: parseViewerContributionsListJson(contributions),
    sessionEditor: parseSessionEditorContributionsListJson(contributions),
    sessionBackend: parseSessionBackendContributionsListJson(contributions),
    syntaxTheme: parseSyntaxThemeContributionsListJson(contributions),
    syntaxThemeProvider: parseSyntaxThemeProviderContributionsListJson(contributions),
    terminalTheme: parseTerminalThemeContributionsListJson(contributions),
    terminalThemeProvider: parseTerminalThemeProviderContributionsListJson(contributions)
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
      mimeTypes: assertJsonStringArrayField(packageJson, "mimeTypes"),
      css: parseCss(packageJson)
    };
  } catch (ex) {
    throw `Failed to process a viewer contribution: ${ex}`;
  }
}

function  parseCss(packageJson: any): ExtensionCss {
  const value = packageJson["css"];
  if (value == null) {
    return {
      directory: null,
      cssFile: [],
      fontAwesome: FONT_AWESOME_DEFAULT
    };
  }

  try {
    return {
      directory: assertJsonStringField(value, "directory", "."),
      cssFile: assertJsonStringArrayField(value, "cssFile", []),
      fontAwesome: assertJsonBooleanField(value, "fontAwesome", FONT_AWESOME_DEFAULT)
    };
  } catch (ex) {
    throw `Failed to process a CSS field: ${ex}`;
  }
}

function parseSessionEditorContributionsListJson(packageJson: any): ExtensionSessionEditorContribution[] {
  const value = packageJson["sessionEditor"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'sessionEditor' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionSessionEditorContribution[] = [];
  for (const item of value) {
    result.push(parseSessionEditorConstributionJson(item));
  }
  return result;
}

function parseSessionEditorConstributionJson(packageJson: any): ExtensionSessionEditorContribution {
  try {
    return {
      name: assertJsonStringField(packageJson, "name"),
      type: assertJsonStringField(packageJson, "type"),
      css: parseCss(packageJson)
    };
  } catch (ex) {
    throw `Failed to process a session editor contribution: ${ex}`;
  }
}

function parseSessionBackendContributionsListJson(packageJson: any): ExtensionSessionBackendContribution[] {
  const value = packageJson["sessionBackend"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'sessionBackend' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionSessionBackendContribution[] = [];
  for (const item of value) {
    result.push(parseSessionBackendConstributionJson(item));
  }
  return result;
}

function parseSessionBackendConstributionJson(packageJson: any): ExtensionSessionBackendContribution {
  try {
    return {
      name: assertJsonStringField(packageJson, "name"),
      type: assertJsonStringField(packageJson, "type")
    };
  } catch (ex) {
    throw `Failed to process a session backend contribution: ${ex}`;
  }
}

function parseSyntaxThemeContributionsListJson(packageJson: any): ExtensionSyntaxThemeContribution[] {
  const value = packageJson["syntaxTheme"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'syntaxTheme' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionSyntaxThemeContribution[] = [];
  for (const item of value) {
    result.push(parseSyntaxThemeContributionsJson(item));
  }
  return result;
}

function parseSyntaxThemeContributionsJson(packageJson: any): ExtensionSyntaxThemeContribution {
  try {
    return {
      path: assertJsonStringField(packageJson, "path")
    };
  } catch (ex) {
    throw `Failed to process a syntax theme contribution: ${ex}`;
  }
}

function parseSyntaxThemeProviderContributionsListJson(packageJson: any): ExtensionSyntaxThemeProviderContribution[] {
  const value = packageJson["syntaxThemeProvider"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'syntaxThemeProvider' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionSyntaxThemeProviderContribution[] = [];
  for (const item of value) {
    result.push(parseSyntaxThemeProviderContributionsJson(item));
  }
  return result;
}

function parseSyntaxThemeProviderContributionsJson(packageJson: any): ExtensionSyntaxThemeProviderContribution {
  try {
    return {
      name: assertJsonStringField(packageJson, "name"),
      humanFormatNames: assertJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  } catch (ex) {
    throw `Failed to process a syntax theme provider contribution: ${ex}`;
  }
}

function parseTerminalThemeContributionsListJson(packageJson: any): ExtensionTerminalThemeContribution[] {
  const value = packageJson["terminalTheme"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'terminalTheme' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionTerminalThemeContribution[] = [];
  for (const item of value) {
    result.push(parseTerminalThemeContributionsJson(item));
  }
  return result;
}

function parseTerminalThemeContributionsJson(packageJson: any): ExtensionTerminalThemeContribution {
  try {
    return {
      path: assertJsonStringField(packageJson, "path")
    };
  } catch (ex) {
    throw `Failed to process a terminal theme contribution: ${ex}`;
  }
}

function parseTerminalThemeProviderContributionsListJson(packageJson: any): ExtensionTerminalThemeProviderContribution[] {
  const value = packageJson["terminalThemeProvider"];
  if (value == null) {
    return [];
  }
  if ( ! Array.isArray(value)) {
    throw `Field 'terminalThemeProvider' of in the 'contributions' object is not an array.`;
  }

  const result: ExtensionTerminalThemeProviderContribution[] = [];
  for (const item of value) {
    result.push(parseTerminalThemeProviderContributionsJson(item));
  }
  return result;
}

function parseTerminalThemeProviderContributionsJson(packageJson: any): ExtensionTerminalThemeProviderContribution {
  try {
    return {
      name: assertJsonStringField(packageJson, "name"),
      humanFormatNames: assertJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  } catch (ex) {
    throw `Failed to process a terminal theme provider contribution: ${ex}`;
  }
}
