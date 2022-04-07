/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as path from "path";

import { Logger, getLogger, log } from "extraterm-logging";

import { ExtensionManager } from "../extension/ExtensionManager.js";
import { KeybindingsFileInfo } from "../config/Config.js";
import { KeybindingsSet, AllLogicalKeybindingsNames, LogicalKeybindingsName, KeybindingsBinding, StackedKeybindingsSet,
  CustomKeybindingsSet } from "./KeybindingsTypes.js";
import { ConfigChangeEvent, ConfigDatabase } from "../config/ConfigDatabase.js";
import { TermKeybindingsMapping } from "./KeybindingsManager.js";

/**
 * Manages reading keybindings files and r/w keybinding customisation files.
 */
export class KeybindingsIOManager {
  private _log: Logger = null;

  #keybindingsFileList: KeybindingsFileInfo[] = null;
  #baseKeybindingsMap: Map<LogicalKeybindingsName, KeybindingsSet> = null;
  #customKeybindingsMap: Map<LogicalKeybindingsName, CustomKeybindingsSet> = null;
  #configDatabase: ConfigDatabase = null;

  #userPath: string = null;
  #extensionManager: ExtensionManager = null;
  #termKeybindingsMapping: TermKeybindingsMapping = null;

  constructor(userPath: string, extensionManager: ExtensionManager, configDatabase: ConfigDatabase) {
    this._log = getLogger("KeybindingsIOManager", this);
    this.#userPath = userPath;
    this.#extensionManager = extensionManager;
    this.#configDatabase = configDatabase;
    this.#initializeCaches();

    this.#extensionManager.onDesiredStateChanged(() => {
      this.#initializeCaches();
    });

    this.#configDatabase.onChange((e: ConfigChangeEvent) => {
      if (e.oldConfig?.keybinding !== e.newConfig.keybinding) {
        this.#initializeCaches();
      }
    });
  }

  #getKeybindingsFileList(): KeybindingsFileInfo[] {
    this.#scan();
    return this.#keybindingsFileList;
  }

  #scan(): void {
    if (this.#keybindingsFileList != null) {
      return;
    }

    const infoLists = this.#getKeybindingsExtensionPaths().map(p => this.#scanKeybindingsDirectory(p));
    this.#keybindingsFileList = infoLists.reduce( (list, accu) => [...list, ...accu], []);
  }

  #initializeCaches(): void {
    this.#clearBaseCaches();
    this.#customKeybindingsMap = new Map<LogicalKeybindingsName, CustomKeybindingsSet>();
    this.#keybindingsFileList = null;

    const flatSet = this.getFlatKeybindingsSet(this.#configDatabase.getGeneralConfig().keybindingsName);
    this.#termKeybindingsMapping = new TermKeybindingsMapping(flatSet, process.platform);
  }

  getCurrentKeybindingsMapping(): TermKeybindingsMapping {
    return this.#termKeybindingsMapping;
  }

  #clearBaseCaches(): void {
    this.#baseKeybindingsMap = new Map<LogicalKeybindingsName, KeybindingsSet>();
  }

  #getKeybindingsExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this.#extensionManager.getActiveExtensions()) {
      for (const st of extension.contributes.keybindings) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  #scanKeybindingsDirectory(directory: string): KeybindingsFileInfo[] {
    const result: KeybindingsFileInfo[] = [];
    if (fs.existsSync(directory)) {
      const contents = fs.readdirSync(directory);
      contents.forEach( (item) => {
        if (item.endsWith(".json")) {
          const name = item.slice(0, -5);

          if (AllLogicalKeybindingsNames.includes(<LogicalKeybindingsName>name)) {
            const info: KeybindingsFileInfo = {
              name: <LogicalKeybindingsName>name,
              filename: item,
              path: directory
            };
            result.push(info);
          }
        }
      });
    }
    return result;
  }

  /**
   * Get a keybindings set with the base set and customisations flatten together.
   */
  getFlatKeybindingsSet(name: LogicalKeybindingsName): KeybindingsSet {
    const baseKeybindingsSet = this.#getBaseKeybindingsSet(name);

    // Hash the custom bindings for speed purposes
    const customizations = this.#getCustomKeybindingsFile(name);
    const customBindingsHash = new Map<string, string[]>();
    for (const customBinding of customizations.customBindings) {
      customBindingsHash.set(customBinding.command, customBinding.keys);
    }

    // Create the new set of bindings with the modifications mixed in.
    const flatBindingsList: KeybindingsBinding[] = [];
    for (const binding of baseKeybindingsSet.bindings) {
      if (customBindingsHash.has(binding.command)) {
        flatBindingsList.push({
          command: binding.command,
          keys: customBindingsHash.get(binding.command)
        });
        customBindingsHash.delete(binding.command);
      } else {
        flatBindingsList.push(binding);
      }
    }

    for (const [key, value] of customBindingsHash) {
      flatBindingsList.push({
        command: key,
        keys: value
      });
    }

    return {
      extends: name,
      bindings: flatBindingsList
    };
  }

  #getBaseKeybindingsSet(name: LogicalKeybindingsName): KeybindingsSet {
    if (this.#baseKeybindingsMap.has(name)) {
      return this.#baseKeybindingsMap.get(name);
    }

    const flatKeybindings = new Map<string, KeybindingsBinding>();
    for (const fileInfo of this.#getKeybindingsFileList()) {
      if (fileInfo.name === name) {
        const keybindingsFile = this.#readKeybindingsFile(name, fileInfo);
        for (const binding of keybindingsFile.bindings) {
          flatKeybindings.set(binding.command, binding);
        }
      }
    }

    const result: KeybindingsSet = {
      extends: name,
      bindings: Array.from(flatKeybindings.values())
    };
    this.#baseKeybindingsMap.set(name, result);

    return result;
  }

  #readKeybindingsFile(name: LogicalKeybindingsName, fileInfo: KeybindingsFileInfo): KeybindingsSet {
    const fullPath = path.join(fileInfo.path, fileInfo.filename);
    const keyBindingJsonString = fs.readFileSync(fullPath, { encoding: "utf8" } );
    let keyBindingsJSON: KeybindingsSet = JSON.parse(keyBindingJsonString);

    if (keyBindingsJSON == null) {
      keyBindingsJSON = { extends: name, bindings: [] };
    }
    if (keyBindingsJSON.bindings == null) {
      keyBindingsJSON.bindings = [];
    }
    return keyBindingsJSON;
  }

  /**
   * Get the keybindings base set and customisations.
   */
  getStackedKeybindings(name: LogicalKeybindingsName): StackedKeybindingsSet {
    return {
      name,
      keybindingsSet: this.#getBaseKeybindingsSet(name),
      customKeybindingsSet: this.#getCustomKeybindingsFile(name)
    };
  }

  #getCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsSet {
    if (this.#customKeybindingsMap.has(name)) {
      return this.#customKeybindingsMap.get(name);
    }

    const customKeybindingsFile = this.#readCustomKeybindingsFile(name);
    this.#customKeybindingsMap.set(name, customKeybindingsFile);
    return customKeybindingsFile;
  }

  #getCustomKeybindingsFilePath(name: LogicalKeybindingsName): string {
    return path.join(this.#userPath, name + ".json");
  }

  #readCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsSet {
    const filePath = this.#getCustomKeybindingsFilePath(name);
    if ( ! fs.existsSync(filePath)) {
      return {
        basedOn: name,
        customBindings: []
      };
    }

    try {
      const contents = fs.readFileSync(filePath, { encoding: "utf8" } );
      return JSON.parse(contents);
    } catch(err) {
      this._log.warn(`Unable to read '${filePath}'. Error: ${err.message}`);
      return {
        basedOn: name,
        customBindings: []
      };
    }
  }

  /**
   * Update a set of customisations and persist it.
   */
  updateCustomKeybindingsFile(customKeybindingsFile: CustomKeybindingsSet): void {
    this.#writeCustomKeybindingsFile(customKeybindingsFile);
    this.#customKeybindingsMap.set(customKeybindingsFile.basedOn, customKeybindingsFile);
    this.#clearBaseCaches();
  }

  #writeCustomKeybindingsFile(customKeybindingsFile: CustomKeybindingsSet): boolean {
    const filePath = this.#getCustomKeybindingsFilePath(customKeybindingsFile.basedOn);
    try {
      fs.writeFileSync(filePath, JSON.stringify(customKeybindingsFile, null, "  "));
    } catch(err) {
      this._log.warn(`Unable to update '${filePath}'. Error: ${err.message}`);
      return false;
    }
    return true;
  }
}
