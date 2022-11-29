/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import { getLogger, Logger } from "extraterm-logging";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";
import { JsonNode, JsonObject } from "json-to-ast";
import jsonParse from "json-to-ast";
import {
  BorderDirection,
  Category,
  ExtensionCommandContribution,
  ExtensionContributes,
  ExtensionKeybindingsContribution,
  ExtensionMenu,
  ExtensionMenusContribution,
  ExtensionMetadata,
  ExtensionPlatform,
  ExtensionSessionBackendContribution,
  ExtensionSessionEditorContribution,
  ExtensionSessionSettingsContribution,
  ExtensionTabContribution,
  ExtensionTabTitlesWidgetContribution,
  ExtensionTerminalBorderContribution,
  ExtensionTerminalThemeContribution,
  ExtensionTerminalThemeProviderContribution,
  ExtensionBlockContribution,
  ExtensionSettingsTabContribution,
  WhenVariables,
} from "./ExtensionMetadata.js";

import { JsonError, assertIsJsonObject, getJsonProperty, throwJsonError, parseObjectListJson, getJsonStringField,
  getJsonNumberField, getJsonStringArrayField, getJsonBooleanField, assertKnownJsonObjectKeys
} from "./JsonToAstUtils.js";

export function parsePackageJsonString(packageJsonString: string, extensionPath: string): ExtensionMetadata {
  return (new PackageParser(extensionPath)).parse(packageJsonString);
}

const categoryList: Category[] = [
  "global",
  "application",
  "window",
  "terminal",
  "hyperlink",
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
      connectedTerminalFocus: false,
      blockFocus: false,
      blockType: null,
      isHyperlink: false,
      hyperlinkURL: null,
      hyperlinkProtocol: null,
      hyperlinkDomain: null,
      hyperlinkFileExtension: null,
    };
    this._bee = new BooleanExpressionEvaluator(variables);
  }

  parse(packageJsonString: string): ExtensionMetadata {
    try {
      const packageJson = jsonParse(packageJsonString, {loc: true});

      const result: ExtensionMetadata = {
        name: getJsonStringField(packageJson, "name"),
        path: this._extensionPath,
        exports: getJsonStringField(packageJson, "exports", null),
        version: getJsonStringField(packageJson, "version"),
        homepage: getJsonStringField(packageJson, "homepage", null),
        keywords: getJsonStringArrayField(packageJson, "keywords", []),
        displayName: getJsonStringField(packageJson, "displayName", null),
        includePlatform: this.parsePlatformsJson(packageJson, "includePlatform"),
        excludePlatform: this.parsePlatformsJson(packageJson, "excludePlatform"),
        description: getJsonStringField(packageJson, "description"),
        contributes: this.parseContributesJson(packageJson),
        isInternal: getJsonBooleanField(packageJson, "isInternal", false),
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
          newTerminal: [],
          terminalTab: [],
          windowMenu: [],
        },
        sessionBackends: [],
        sessionEditors: [],
        sessionSettings: [],
        tabs: [],
        tabTitleWidgets: [],
        terminalBorderWidgets: [],
        terminalThemes: [],
        terminalThemeProviders: [],
        blocks: [],
        settingsTabs: [],
      };
    }

    if (contributes.type !== "Object") {
      return throwJsonError(`'contributes' field is not an object.`, contributes);
    }

    const knownContributions: (keyof ExtensionContributes)[] = [
      "commands",
      "keybindings",
      "menus",
      "blocks",
      "sessionEditors",
      "sessionBackends",
      "sessionSettings",
      "tabs",
      "tabTitleWidgets",
      "terminalBorderWidgets",
      "terminalThemes",
      "terminalThemeProviders",
      "settingsTabs"
    ];
    assertKnownJsonObjectKeys(contributes, knownContributions);

    return {
      commands: parseObjectListJson(contributes, "commands", node => this.parseCommandContributionJson(node)),
      menus: this.parseMenuContributions(contributes),
      keybindings: parseObjectListJson(contributes, "keybindings", node => this.parseKeybindingsContributionsJson(node)),
      sessionBackends: parseObjectListJson(contributes, "sessionBackends", node => this.parseSessionBackendConstributionJson(node)),
      sessionEditors: parseObjectListJson(contributes, "sessionEditors", node => this.parseSessionEditorConstributionJson(node)),
      sessionSettings: parseObjectListJson(contributes, "sessionSettings", node => this.parseSessionSettingsConstributionJson(node)),
      tabs: parseObjectListJson(contributes, "tabs", node => this.parseTabContributionJson(node)),
      tabTitleWidgets: parseObjectListJson(contributes, "tabTitleWidgets", node => this.parseTabTitleItemContributionsJson(node)),
      terminalBorderWidgets: parseObjectListJson(contributes, "terminalBorderWidgets", node => this.parseTerminalBorderWidgetContributionsJson(node)),
      terminalThemes: parseObjectListJson(contributes, "terminalThemes", node => this.parseTerminalThemeContributionsJson(node)),
      terminalThemeProviders: parseObjectListJson(contributes, "terminalThemeProviders", node => this.parseTerminalThemeProviderContributionsJson(node)),
      blocks: parseObjectListJson(contributes, "blocks", node => this.parseBlockConstributionJson(node)),
      settingsTabs: parseObjectListJson(contributes, "settingsTabs", node => this.#parseSettingsTabConstributionJson(node)),
    };
  }

  private parseBlockConstributionJson(packageJson: JsonNode): ExtensionBlockContribution {
    const knownKeys: (keyof ExtensionBlockContribution)[] = [
      "name",
      "mimeTypes",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      name: getJsonStringField(packageJson, "name"),
      mimeTypes: getJsonStringArrayField(packageJson, "mimeTypes", []),
    };
  }

  #parseSettingsTabConstributionJson(packageJson: JsonNode): ExtensionSettingsTabContribution {
    const knownKeys: (keyof ExtensionSettingsTabContribution)[] = [
      "name",
      "title",
      "icon",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      name: getJsonStringField(packageJson, "name"),
      icon: getJsonStringField(packageJson, "icon", null),
      title: getJsonStringField(packageJson, "title"),
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
        newTerminal: [],
        terminalTab: [],
        windowMenu: [],
      };
    }

    const knownKeys: (keyof ExtensionMenusContribution)[] = [
      "contextMenu",
      "commandPalette",
      "newTerminal",
      "terminalTab",
      "windowMenu",
    ];
    assertKnownJsonObjectKeys(menus, knownKeys);

    const menusObject = assertIsJsonObject(menus);
    return {
      contextMenu: this.parseMenuContribution(menusObject, "contextMenu"),
      commandPalette: this.parseMenuContribution(menusObject, "commandPalette"),
      newTerminal: this.parseMenuContribution(menusObject, "newTerminal"),
      terminalTab: this.parseMenuContribution(menusObject, "terminalTab"),
      windowMenu: this.parseMenuContribution(menusObject, "windowMenu"),
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
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      name: getJsonStringField(packageJson, "name"),
      type: getJsonStringField(packageJson, "type"),
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

  private parseSessionSettingsConstributionJson(packageJson: JsonNode): ExtensionSessionSettingsContribution {
    const knownKeys: (keyof ExtensionSessionSettingsContribution)[] = [
      "id",
      "name",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);

    return {
      id: getJsonStringField(packageJson, "id"),
      name: getJsonStringField(packageJson, "name"),
    };
  }

  private parseTabTitleItemContributionsJson(packageJson: JsonNode): ExtensionTabTitlesWidgetContribution {
    const knownKeys: (keyof ExtensionTabTitlesWidgetContribution)[] = [
      "name",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
    };
  }

  private parseTerminalBorderWidgetContributionsJson(packageJson: JsonNode): ExtensionTerminalBorderContribution {
    const knownKeys: (keyof ExtensionTerminalBorderContribution)[] = [
      "name",
      "border",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
      border: this.getJsonBorderDirectionField(packageJson, "border"),
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

  private parseTabContributionJson(packageJson: JsonNode): ExtensionTabContribution {
    const knownKeys: (keyof ExtensionTerminalBorderContribution)[] = [
      "name",
    ];
    assertKnownJsonObjectKeys(packageJson, knownKeys);
    return {
      name: getJsonStringField(packageJson, "name"),
    };
  }

}
