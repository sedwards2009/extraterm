/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import { ExtensionContributes, ExtensionMetadata, ExtensionViewerContribution, ExtensionCss, ExtensionSessionEditorContribution, ExtensionSessionBackendContribution, ExtensionPlatform, ExtensionSyntaxThemeProviderContribution, ExtensionSyntaxThemeContribution, ExtensionTerminalThemeProviderContribution, ExtensionTerminalThemeContribution, ExtensionKeybindingsContribution, ExtensionCommandContribution, Category, WhenVariables, ExtensionTerminalBorderContribution, BorderDirection } from "../../ExtensionMetadata";
import { getLogger, Logger } from "extraterm-logging";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";
import { JsonNode, JsonObject } from "json-to-ast";
import jsonParse = require("json-to-ast");

import { JsonError, assertIsJsonObject, getJsonProperty, throwJsonError, parseObjectListJson, getJsonStringField, getJsonNumberField, getJsonStringArrayField, getJsonBooleanField } from "./JsonToAstUtils";

const FONT_AWESOME_DEFAULT = false;

export function parsePackageJsonString(packageJsonString: string, extensionPath: string): ExtensionMetadata {
  return (new PackageParser(extensionPath)).parse(packageJsonString);
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

  parse(packageJsonString: string): ExtensionMetadata {
    try {
      const packageJson = jsonParse(packageJsonString, {loc: true});

      const result: ExtensionMetadata = {
        name: getJsonStringField(packageJson, "name"),
        path: this._extensionPath,
        main: getJsonStringField(packageJson, "main", null),
        version: getJsonStringField(packageJson, "version"),
        includePlatform: this.parsePlatformsJson(packageJson, "includePlatform"),
        excludePlatform: this.parsePlatformsJson(packageJson, "excludePlatform"),
        description: getJsonStringField(packageJson, "description"),
        contributes: this.parseContributesJson(packageJson)
      };
      return result;
    } catch(ex) {
      if (ex instanceof JsonError) {
        const loc = ex.node.loc;
        throw `${ex.msg}\n${path.join(this._extensionPath, "package.json")} line: ${loc.start.line} column: ${loc.start.column}`;
      } else {
        throw ex;
      }
    }
  }

  private getJsonCategoryField(packageJson: JsonNode, fieldName: string): Category {
    const value = getJsonStringField(packageJson, fieldName, null);
    if (value == null) {
      return "window";
    }

    if ((<string[]>categoryList).indexOf(value) === -1) {
      return throwJsonError(`Field '${fieldName}' is not one of ${categoryList.join(", ")}.`,
        getJsonProperty(<JsonObject>packageJson, fieldName));
    }
    return <Category> value;
  }

  private parsePlatformsJson(packageJson: JsonNode, fieldName: string): ExtensionPlatform[] {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      return [];
    }

    if (value.type === "Array") {
      const result = [];
      for (let i=0; i < value.children.length; i++) {
        result.push(this.parsePlatformJson(value.children[i]));
      }
      return result;
    }    

    return throwJsonError(`Field '${fieldName}' is not an array.`, value);
  }

  private parsePlatformJson(packageJson: JsonNode): ExtensionPlatform {
    return {
      os: getJsonStringField(packageJson, "os", null),
      arch: getJsonStringField(packageJson, "arch", null)
    };
  }

  private parseContributesJson(packageJson: JsonNode): ExtensionContributes {
    const jsonObject = assertIsJsonObject(packageJson);
    const contributes = getJsonProperty(jsonObject, "contributes");
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

    if (contributes.type !== "Object") {
      return throwJsonError(`'contributes' field is not an object.`, contributes);
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
    for (const key of contributes.children) {
      if (knownContributions.indexOf(<any> key.key.value) === -1) {
        return throwJsonError(`'contributes' contains an unknown property '${key}'`, contributes);
      }
    }

    return {
      commands: parseObjectListJson(contributes, "commands", node => this.parseCommandContributionJson(node)),
      keybindings: parseObjectListJson(contributes, "keybindings", node => this.parseKeybindingsContributionsJson(node)),
      sessionBackends: parseObjectListJson(contributes, "sessionBackends", node => this.parseSessionBackendConstributionJson(node)),
      sessionEditors: parseObjectListJson(contributes, "sessionEditors", node => this.parseSessionEditorConstributionJson(node)),
      syntaxThemes: parseObjectListJson(contributes, "syntaxThemes", node => this.parseSyntaxThemeContributionsJson(node)),
      syntaxThemeProviders: parseObjectListJson(contributes, "syntaxThemeProviders", node => this.parseSyntaxThemeProviderContributionsJson(node)),
      terminalBorderWidget: parseObjectListJson(contributes, "terminalBorderWidget", node => this.parseTerminalBorderWidgetContributionsJson(node)),
      terminalThemes: parseObjectListJson(contributes, "terminalThemes", node => this.parseTerminalThemeContributionsJson(node)),
      terminalThemeProviders: parseObjectListJson(contributes, "terminalThemeProviders", node => this.parseTerminalThemeProviderContributionsJson(node)),
      viewers: parseObjectListJson(contributes, "viewers", node => this.parseViewerConstributionJson(node)),
    };
  }

  private parseViewerConstributionJson(packageJson: JsonNode): ExtensionViewerContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      mimeTypes: getJsonStringArrayField(packageJson, "mimeTypes"),
      css: this.parseCss(packageJson)
    };
  }

  private  parseCss(packageJson: JsonNode): ExtensionCss {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, "css");
    if (value == null) {
      return {
        directory: null,
        cssFile: [],
        fontAwesome: FONT_AWESOME_DEFAULT
      };
    }

    return {
      directory: getJsonStringField(value, "directory", "."),
      cssFile: getJsonStringArrayField(value, "cssFile", []),
      fontAwesome: getJsonBooleanField(value, "fontAwesome", FONT_AWESOME_DEFAULT)
    };
  }

  private parseCommandContributionJson(packageJson: JsonNode): ExtensionCommandContribution {
    return {
      command: getJsonStringField(packageJson, "command"),
      title: getJsonStringField(packageJson, "title"),
      when: this.getJsonWhenField(packageJson, "when", ""),
      category: this.getJsonCategoryField(packageJson, "category"),
      order: getJsonNumberField(packageJson, "order", 100000),
      commandPalette: getJsonBooleanField(packageJson, "commandPalette", true),
      contextMenu: getJsonBooleanField(packageJson, "contextMenu", false),
      emptyPaneMenu: getJsonBooleanField(packageJson, "emptyPaneMenu", false),
      newTerminalMenu: getJsonBooleanField(packageJson, "newTerminalMenu", false),
      icon: getJsonStringField(packageJson, "icon", ""),
    };
  }

  private getJsonWhenField(packageJson: JsonNode, fieldName: string, defaultValue: string=undefined): string {
    const value = getJsonStringField(packageJson, fieldName, defaultValue);

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

  private parseSessionEditorConstributionJson(packageJson: JsonNode): ExtensionSessionEditorContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      type: getJsonStringField(packageJson, "type"),
      css: this.parseCss(packageJson)
    };
  }

  private parseSessionBackendConstributionJson(packageJson: JsonNode): ExtensionSessionBackendContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      type: getJsonStringField(packageJson, "type")
    };
  }

  private parseSyntaxThemeContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeContribution {
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }

  private parseSyntaxThemeProviderContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeProviderContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      humanFormatNames: getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseTerminalBorderWidgetContributionsJson(packageJson: JsonNode): ExtensionTerminalBorderContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      border: this.getJsonBorderDirectionField(packageJson, "border"),
      css: this.parseCss(packageJson)
    };
  }

  private getJsonBorderDirectionField(packageJson: JsonNode, fieldName: string): BorderDirection {
    const jsonObject = assertIsJsonObject(packageJson);
    const value = getJsonProperty(jsonObject, fieldName);
    if (value == null) {
      return "south";
    }

    if (value.type === "Literal" && typeof value.value === "string") {
      const borderDirections: BorderDirection[] = ["north", "south", "east", "west"];
      if (borderDirections.indexOf(<BorderDirection> value.value) === -1) {
        return throwJsonError(`Field '${fieldName}' is not one of ${borderDirections.join(", ")}.`, value);
      }
      return <BorderDirection> value.value;
    }

    return throwJsonError(`Field '${fieldName}' is not a string.`, value);
  }

  private parseTerminalThemeContributionsJson(packageJson: JsonNode): ExtensionTerminalThemeContribution {
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }

  private parseTerminalThemeProviderContributionsJson(packageJson: JsonNode): ExtensionTerminalThemeProviderContribution {
    return {
      name: getJsonStringField(packageJson, "name"),
      humanFormatNames: getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseKeybindingsContributionsJson(packageJson: JsonNode): ExtensionKeybindingsContribution {
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }
}
