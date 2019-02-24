/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContributes, ExtensionMetadata, ExtensionViewerContribution, ExtensionCss, ExtensionSessionEditorContribution, ExtensionSessionBackendContribution, ExtensionPlatform, ExtensionSyntaxThemeProviderContribution, ExtensionSyntaxThemeContribution, ExtensionTerminalThemeProviderContribution, ExtensionTerminalThemeContribution, ExtensionKeybindingsContribution, ExtensionCommandContribution, Category, WhenVariables, ExtensionTerminalBorderContribution, BorderDirection } from "../../ExtensionMetadata";
import { getLogger, Logger } from "extraterm-logging";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";

const FONT_AWESOME_DEFAULT = false;


export function parsePackageJson(packageJson: any, extensionPath: string): ExtensionMetadata {
  return (new PackageParser(extensionPath)).parse(packageJson);
}

const categoryList: Category[] = [
  "global",
  "application",
  "window",
  "textEditing",
  "terminal",
  "terminalCursorMode",
  "viewer"
];

class PackageParser {
  private _log: Logger;
  private _bee: BooleanExpressionEvaluator;

  constructor(private _extensionPath: string) {
    this._log = getLogger("PackageParser", this);

    const variables: WhenVariables = {
      true: true,
      false: false,
      terminalFocus: false,
      isCursorMode: false,
      isNormalMode: false,
      textEditorFocus: false,
      isTextEditing: false,
      viewerFocus: false,
    };
    this._bee = new BooleanExpressionEvaluator(variables);
  }

  parse(packageJson: any): ExtensionMetadata {
    const result: ExtensionMetadata = {
      name: this.assertJsonStringField(packageJson, "name"),
      path: this._extensionPath,
      main: this.assertJsonStringField(packageJson, "main", null),
      version: this.assertJsonStringField(packageJson, "version"),
      includePlatform: this.parsePlatformsJson(packageJson, "includePlatform"),
      excludePlatform: this.parsePlatformsJson(packageJson, "excludePlatform"),
      description: this.assertJsonStringField(packageJson, "description"),
      contributes: this.parseContributesJson(packageJson)
    };
    return result;
  }

  private assertJsonStringField(packageJson: any, fieldName: string, defaultValue: string=undefined): string {
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

  private assertJsonNumberField(packageJson: any, fieldName: string, defaultValue: number=1000000): number {
    const value = packageJson[fieldName];
    if (value == null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw `Field '${fieldName}' is missing.`;
    }

    if (typeof value !== "number") {
      throw `Field '${fieldName}' is not a number.`;
    }
    
    return value;
  }

  private assertJsonCategoryField(packageJson: any, fieldName: string): Category {
    const value = packageJson[fieldName];
    if (value == null) {
      return "window";
    }

    if (categoryList.indexOf(value) === -1) {
      throw `Field '${fieldName}' is not one of ${categoryList.join(", ")}.`;
    }
    return value;
  }

  private assertJsonBooleanField(packageJson: any, fieldName: string, defaultValue: boolean): boolean {
    const value = packageJson[fieldName];
    if (value == null) {
      return defaultValue;
    }

    if (typeof value !== "boolean") {
      throw `Field '${fieldName}' is not a boolean.`;
    }
    return value;
  }

  private assertJsonStringArrayField(packageJson: any, fieldName: string, defaultValue: string[]=undefined): string[] {
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

  private parsePlatformsJson(packageJson: any, fieldName: string): ExtensionPlatform[] {
    const value = packageJson[fieldName];
    if (value == null) {
      return [];
    }

    if ( ! Array.isArray(value)) {
      throw `Field '${fieldName}' is not an array.`;
    }

    const result = [];
    for (let i=0; i < value.length; i++) {
      result.push(this.parsePlatformJson(value[i]))
    }
    return result;
  }

  private parsePlatformJson(packageJson: any): ExtensionPlatform {
    try {
      return {
        os: this.assertJsonStringField(packageJson, "os", null),
        arch: this.assertJsonStringField(packageJson, "arch", null)
      };
    } catch (ex) {
      throw `Failed to process a platform specification: ${ex}`;
    }
  }

  private parseContributesJson(packageJson: any): ExtensionContributes {
    const contributes = packageJson["contributes"];
    if (contributes == null) {
      return {
        commands: [],
        keybindings: [],
        sessionBackends: [],
        sessionEditors: [],
        syntaxThemes: [],
        syntaxThemeProviders: [],
        terminalBorderWidget: [],
        terminalThemes: [],
        terminalThemeProviders: [],
        viewers: [],
      };
    }

    if (typeof contributes !== "object") {
      throw `'contributes' field is not an object.`;
    }

    const knownContributions: (keyof ExtensionContributes)[] = [
      "commands",
      "keybindings",
      "viewers",
      "sessionEditors",
      "sessionBackends",
      "syntaxThemes",
      "syntaxThemeProviders",
      "terminalBorderWidget",
      "terminalThemes",
      "terminalThemeProviders"
    ];
    for (const key in contributes) {
      if (contributes.hasOwnProperty(key)) {
        if (knownContributions.indexOf(<any> key) === -1) {
          throw `'contributes' contains an unknown property '${key}'`;
        }
      }
    }

    return {
      commands: this.parseCommandContributionsListJson(contributes),
      keybindings: this.parseKeybindingsContributionsListJson(contributes),
      sessionBackends: this.parseSessionBackendContributionsListJson(contributes),
      sessionEditors: this.parseSessionEditorContributionsListJson(contributes),
      syntaxThemes: this.parseSyntaxThemeContributionsListJson(contributes),
      syntaxThemeProviders: this.parseSyntaxThemeProviderContributionsListJson(contributes),
      terminalBorderWidget: this.parseTerminalBorderWidgetContributionsListJson(contributes),
      terminalThemes: this.parseTerminalThemeContributionsListJson(contributes),
      terminalThemeProviders: this.parseTerminalThemeProviderContributionsListJson(contributes),
      viewers: this.parseViewerContributionsListJson(contributes),
    };
  }

  private parseViewerContributionsListJson(packageJson: any): ExtensionViewerContribution[] {
    const value = packageJson["viewers"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'viewers' of in the 'contributes' object is not an array.`;
    }

    const result: ExtensionViewerContribution[] = [];
    for (const item of value) {
      result.push(this.parseViewerConstributionJson(item));
    }
    return result;
  }

  private parseViewerConstributionJson(packageJson: any): ExtensionViewerContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        mimeTypes: this.assertJsonStringArrayField(packageJson, "mimeTypes"),
        css: this.parseCss(packageJson)
      };
    } catch (ex) {
      throw `Failed to process a viewer contribution: ${ex}`;
    }
  }

  private  parseCss(packageJson: any): ExtensionCss {
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
        directory: this.assertJsonStringField(value, "directory", "."),
        cssFile: this.assertJsonStringArrayField(value, "cssFile", []),
        fontAwesome: this.assertJsonBooleanField(value, "fontAwesome", FONT_AWESOME_DEFAULT)
      };
    } catch (ex) {
      throw `Failed to process a CSS field: ${ex}`;
    }
  }

  private parseCommandContributionsListJson(packageJson: any): ExtensionCommandContribution[] {
    const value = packageJson["commands"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'commands' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionCommandContribution[] = [];
    for (const item of value) {
      result.push(this.parseCommandConstributionJson(item));
    }
    return result;
  }

  private parseCommandConstributionJson(packageJson: any): ExtensionCommandContribution {
    try {
      return {
        command: this.assertJsonStringField(packageJson, "command"),
        title: this.assertJsonStringField(packageJson, "title"),
        when: this.assertJsonWhenField(packageJson, "when", ""),
        category: this.assertJsonCategoryField(packageJson, "category"),
        order: this.assertJsonNumberField(packageJson, "order", 100000),
        commandPalette: this.assertJsonBooleanField(packageJson, "commandPalette", true),
        contextMenu: this.assertJsonBooleanField(packageJson, "contextMenu", false),
        emptyPaneMenu: this.assertJsonBooleanField(packageJson, "emptyPaneMenu", false),
        newTerminalMenu: this.assertJsonBooleanField(packageJson, "newTerminalMenu", false),
        icon: this.assertJsonStringField(packageJson, "icon", ""),
      };
    } catch (ex) {
      throw `Failed to process a command contribution: ${ex}`;
    }
  }

  private assertJsonWhenField(packageJson: any, fieldName: string, defaultValue: string=undefined): string {
    const value = this.assertJsonStringField(packageJson, fieldName, defaultValue);

    if (value.trim() === "") {
      return "true";
    }

    try {
      this._bee.evaluate(value);
    } catch(ex) {
      this._log.warn(`When clause '${value}' in package '${this._extensionPath}' has an error:\n` + ex);
      return "false";
    }
    return value;
  }

  private parseSessionEditorContributionsListJson(packageJson: any): ExtensionSessionEditorContribution[] {
    const value = packageJson["sessionEditors"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'sessionEditors' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionSessionEditorContribution[] = [];
    for (const item of value) {
      result.push(this.parseSessionEditorConstributionJson(item));
    }
    return result;
  }

  private parseSessionEditorConstributionJson(packageJson: any): ExtensionSessionEditorContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        type: this.assertJsonStringField(packageJson, "type"),
        css: this.parseCss(packageJson)
      };
    } catch (ex) {
      throw `Failed to process a session editor contribution: ${ex}`;
    }
  }

  private parseSessionBackendContributionsListJson(packageJson: any): ExtensionSessionBackendContribution[] {
    const value = packageJson["sessionBackends"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'sessionBackends' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionSessionBackendContribution[] = [];
    for (const item of value) {
      result.push(this.parseSessionBackendConstributionJson(item));
    }
    return result;
  }

  private parseSessionBackendConstributionJson(packageJson: any): ExtensionSessionBackendContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        type: this.assertJsonStringField(packageJson, "type")
      };
    } catch (ex) {
      throw `Failed to process a session backend contribution: ${ex}`;
    }
  }

  private parseSyntaxThemeContributionsListJson(packageJson: any): ExtensionSyntaxThemeContribution[] {
    const value = packageJson["syntaxThemes"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'syntaxThemes' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionSyntaxThemeContribution[] = [];
    for (const item of value) {
      result.push(this.parseSyntaxThemeContributionsJson(item));
    }
    return result;
  }

  private parseSyntaxThemeContributionsJson(packageJson: any): ExtensionSyntaxThemeContribution {
    try {
      return {
        path: this.assertJsonStringField(packageJson, "path")
      };
    } catch (ex) {
      throw `Failed to process a syntax theme contribution: ${ex}`;
    }
  }

  private parseSyntaxThemeProviderContributionsListJson(packageJson: any): ExtensionSyntaxThemeProviderContribution[] {
    const value = packageJson["syntaxThemeProviders"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'syntaxThemeProviders' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionSyntaxThemeProviderContribution[] = [];
    for (const item of value) {
      result.push(this.parseSyntaxThemeProviderContributionsJson(item));
    }
    return result;
  }

  private parseSyntaxThemeProviderContributionsJson(packageJson: any): ExtensionSyntaxThemeProviderContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        humanFormatNames: this.assertJsonStringArrayField(packageJson, "humanFormatNames", [])
      };
    } catch (ex) {
      throw `Failed to process a syntax theme provider contribution: ${ex}`;
    }
  }

  private parseTerminalBorderWidgetContributionsListJson(packageJson: any): ExtensionTerminalBorderContribution[] {
    const value = packageJson["terminalBorderWidget"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'terminalBorderWidget' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionTerminalBorderContribution[] = [];
    for (const item of value) {
      result.push(this.parseTerminalBorderWidgetContributionsJson(item));
    }
    return result;
  }

  private parseTerminalBorderWidgetContributionsJson(packageJson: any): ExtensionTerminalBorderContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        border: this.assertJsonBorderDirectionField(packageJson, "border"),
        css: this.parseCss(packageJson)
      };
    } catch (ex) {
      throw `Failed to process a session editor contribution: ${ex}`;
    }
  }

  private assertJsonBorderDirectionField(packageJson: any, fieldName: string): BorderDirection {
    const value = packageJson[fieldName];
    if (value == null) {
      return "south";
    }

    const borderDirections: BorderDirection[] = ["north", "south", "east", "west"];
    if (borderDirections.indexOf(value) === -1) {
      throw `Field '${fieldName}' is not one of ${borderDirections.join(", ")}.`;
    }
    return value;
  }

  private parseTerminalThemeContributionsListJson(packageJson: any): ExtensionTerminalThemeContribution[] {
    const value = packageJson["terminalThemes"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'terminalTheme' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionTerminalThemeContribution[] = [];
    for (const item of value) {
      result.push(this.parseTerminalThemeContributionsJson(item));
    }
    return result;
  }

  private parseTerminalThemeContributionsJson(packageJson: any): ExtensionTerminalThemeContribution {
    try {
      return {
        path: this.assertJsonStringField(packageJson, "path")
      };
    } catch (ex) {
      throw `Failed to process a terminal theme contribution: ${ex}`;
    }
  }

  private parseTerminalThemeProviderContributionsListJson(packageJson: any): ExtensionTerminalThemeProviderContribution[] {
    const value = packageJson["terminalThemeProviders"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'terminalThemeProviders' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionTerminalThemeProviderContribution[] = [];
    for (const item of value) {
      result.push(this.parseTerminalThemeProviderContributionsJson(item));
    }
    return result;
  }

  private parseTerminalThemeProviderContributionsJson(packageJson: any): ExtensionTerminalThemeProviderContribution {
    try {
      return {
        name: this.assertJsonStringField(packageJson, "name"),
        humanFormatNames: this.assertJsonStringArrayField(packageJson, "humanFormatNames", [])
      };
    } catch (ex) {
      throw `Failed to process a terminal theme provider contribution: ${ex}`;
    }
  }

  private parseKeybindingsContributionsListJson(packageJson: any): ExtensionKeybindingsContribution[] {
    const value = packageJson["keybindings"];
    if (value == null) {
      return [];
    }
    if ( ! Array.isArray(value)) {
      throw `Field 'keybindings' in the 'contributes' object is not an array.`;
    }

    const result: ExtensionKeybindingsContribution[] = [];
    for (const item of value) {
      result.push(this.parseKeybindingsContributionsJson(item));
    }
    return result;
  }

  private parseKeybindingsContributionsJson(packageJson: any): ExtensionKeybindingsContribution {
    try {
      return {
        path: this.assertJsonStringField(packageJson, "path")
      };
    } catch (ex) {
      throw `Failed to process a syntax theme contribution: ${ex}`;
    }
  }
}
