/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import { ExtensionContributes, ExtensionMetadata, ExtensionViewerContribution, ExtensionCss, ExtensionSessionEditorContribution, ExtensionSessionBackendContribution, ExtensionPlatform, ExtensionSyntaxThemeProviderContribution, ExtensionSyntaxThemeContribution, ExtensionTerminalThemeProviderContribution, ExtensionTerminalThemeContribution, ExtensionKeybindingsContribution, ExtensionCommandContribution, Category, WhenVariables, ExtensionTerminalBorderContribution, BorderDirection, ExtensionMenusContribution, ExtensionMenu } from "../../ExtensionMetadata";
import { getLogger, Logger } from "extraterm-logging";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";
import { JsonNode, JsonObject } from "json-to-ast";
import jsonParse = require("json-to-ast");

import { JsonError, assertIsJsonObject, getJsonProperty, throwJsonError, parseObjectListJson, getJsonStringField, getJsonNumberField, getJsonStringArrayField, getJsonBooleanField, assertKnownJsonObjectKeys } from "./JsonToAstUtils";

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
    const knownContributions: (keyof ExtensionPlatform)[] = [
      "os",
      "arch",
    ];
    assertKnownJsonObjectKeys(packageJson, knownContributions);

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
        menus: {
          contextMenu: [],
          commandPalette: [],
          emptyPane: [],
          newTerminal: [],
          terminalTab: [],
        },
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
      "menus",
      "viewers",
      "sessionEditors",
      "sessionBackends",
      "syntaxThemes",
      "syntaxThemeProviders",
      "terminalBorderWidget",
      "terminalThemes",
      "terminalThemeProviders"
    ];
    assertKnownJsonObjectKeys(contributes, knownContributions);

    return {
      commands: parseObjectListJson(contributes, "commands", node => this.parseCommandContributionJson(node)),
      menus: this.parseMenuContributions(contributes),
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
    const knownKeys: (keyof ExtensionViewerContribution)[] = [
      "name",
      "mimeTypes",
      "css",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

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

    const knownKeys: (keyof ExtensionCss)[] = [
      "directory",
      "cssFile",
      "fontAwesome",
    ];
    assertKnownJsonObjectKeys(value, knownKeys);

    return {
      directory: getJsonStringField(value, "directory", "."),
      cssFile: getJsonStringArrayField(value, "cssFile", []),
      fontAwesome: getJsonBooleanField(value, "fontAwesome", FONT_AWESOME_DEFAULT)
    };
  }

  private parseCommandContributionJson(packageJson: JsonNode): ExtensionCommandContribution {
    const knownKeys: (keyof ExtensionCommandContribution)[] = [
      "command",
      "title",
      "when",
      "category",
      "order",
      "icon",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      command: getJsonStringField(packageJson, "command"),
      title: getJsonStringField(packageJson, "title"),
      when: this.getJsonWhenField(packageJson, "when", ""),
      category: this.getJsonCategoryField(packageJson, "category"),
      order: getJsonNumberField(packageJson, "order", 100000),
      icon: getJsonStringField(packageJson, "icon", ""),
    };
  }

  private parseMenuContributions(contributesJson: JsonObject): ExtensionMenusContribution {
    const menus = getJsonProperty(contributesJson, "menus");
    if (menus == null) {
      return {
        contextMenu: [],
        commandPalette: [],
        emptyPane: [],
        newTerminal: [],
        terminalTab: [],
      };
    }

    const knownKeys: (keyof ExtensionMenusContribution)[] = [
      "contextMenu",
      "commandPalette",
      "emptyPane",
      "newTerminal",
      "terminalTab",
    ];
    assertKnownJsonObjectKeys(menus, knownKeys);

    const menusObject = assertIsJsonObject(menus);
    return {
      contextMenu: this.parseMenuContribution(menusObject, "contextMenu"),
      commandPalette: this.parseMenuContribution(menusObject, "commandPalette"),
      emptyPane: this.parseMenuContribution(menusObject, "emptyPane"),
      newTerminal: this.parseMenuContribution(menusObject, "newTerminal"),
      terminalTab: this.parseMenuContribution(menusObject, "terminalTab"),
    };
  }

  private parseMenuContribution(menusObject: JsonObject, fieldName: string): ExtensionMenu[] {
    const prop = getJsonProperty(menusObject, fieldName);
    if (prop == null) {
      return [];
    }
    
    const knownKeys: (keyof ExtensionMenu)[] = [
      "command",
      "show",
    ];

    return parseObjectListJson(menusObject, fieldName, 
      (node: JsonNode): ExtensionMenu => {
        assertKnownJsonObjectKeys(node, knownKeys);
        const jsonObject = assertIsJsonObject(node);

        return {
          command: getJsonStringField(jsonObject, "command"),
          show: getJsonBooleanField(jsonObject, "show", true)
        };
      });
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
    const knownKeys: (keyof ExtensionSessionEditorContribution)[] = [
      "name",
      "type",
      "css",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      name: getJsonStringField(packageJson, "name"),
      type: getJsonStringField(packageJson, "type"),
      css: this.parseCss(packageJson)
    };
  }

  private parseSessionBackendConstributionJson(packageJson: JsonNode): ExtensionSessionBackendContribution {
    const knownKeys: (keyof ExtensionSessionBackendContribution)[] = [
      "name",
      "type",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
      type: getJsonStringField(packageJson, "type")
    };
  }

  private parseSyntaxThemeContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeContribution {
    const knownKeys: (keyof ExtensionSyntaxThemeContribution)[] = [
      "path",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }

  private parseSyntaxThemeProviderContributionsJson(packageJson: JsonNode): ExtensionSyntaxThemeProviderContribution {
    const knownKeys: (keyof ExtensionSyntaxThemeProviderContribution)[] = [
      "name",
      "humanFormatNames",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
      humanFormatNames: getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseTerminalBorderWidgetContributionsJson(packageJson: JsonNode): ExtensionTerminalBorderContribution {
    const knownKeys: (keyof ExtensionTerminalBorderContribution)[] = [
      "name",
      "border",
      "css",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
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
    const knownKeys: (keyof ExtensionTerminalThemeContribution)[] = [
      "path",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }

  private parseTerminalThemeProviderContributionsJson(packageJson: JsonNode): ExtensionTerminalThemeProviderContribution {
    const knownKeys: (keyof ExtensionTerminalThemeProviderContribution)[] = [
      "name",
      "humanFormatNames",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
      humanFormatNames: getJsonStringArrayField(packageJson, "humanFormatNames", [])
    };
  }

  private parseKeybindingsContributionsJson(packageJson: JsonNode): ExtensionKeybindingsContribution {
    const knownKeys: (keyof ExtensionKeybindingsContribution)[] = [
      "path",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      path: getJsonStringField(packageJson, "path")
    };
  }
}
