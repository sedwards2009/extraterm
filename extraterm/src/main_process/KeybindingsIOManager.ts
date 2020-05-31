/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';

import {Logger, getLogger, log} from "extraterm-logging";

import { MainExtensionManager } from './extension/MainExtensionManager';
import { KeybindingsFileInfo } from '../Config';
import { KeybindingsSet, AllLogicalKeybindingsNames, LogicalKeybindingsName, KeybindingsBinding, StackedKeybindingsSet,
  CustomKeybindingsSet } from '../keybindings/KeybindingsTypes';
import { EventEmitter } from '../utils/EventEmitter';
import { Event } from '@extraterm/extraterm-extension-api';

/**
 * Manages reading keybindings files and r/w keybinding customisation files.
 */
export class KeybindingsIOManager {

  private _log: Logger = null;
  private _keybindingsFileList: KeybindingsFileInfo[] = null;
  private _baseKeybindingsMap: Map<LogicalKeybindingsName, KeybindingsSet> = null;
  private _customKeybindingsMap: Map<LogicalKeybindingsName, CustomKeybindingsSet> = null;

  private _onUpdateEventEmitter = new EventEmitter<void>();
  onUpdate: Event<void>;

  constructor(private _userPath: string, private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("KeybindingsIOManager", this);
    this._clearCaches();
    this.onUpdate = this._onUpdateEventEmitter.event;
    this._mainExtensionManager.onDesiredStateChanged(() => {
      this._clearCaches();
      this._onUpdateEventEmitter.fire();
    });
  }

  private _getKeybindingsFileList(): KeybindingsFileInfo[] {
    this._scan();
    return this._keybindingsFileList;
  }

  private _scan(): void {
    if (this._keybindingsFileList != null) {
      return;
    }

    const infoLists = this._getKeybindingsExtensionPaths().map(p => this._scanKeybindingsDirectory(p));
    this._keybindingsFileList = infoLists.reduce( (list, accu) => [...list, ...accu], []);
  }

  private _clearCaches(): void {
    this._clearBaseCaches();
    this._customKeybindingsMap = new Map<LogicalKeybindingsName, CustomKeybindingsSet>();
    this._keybindingsFileList = null;
  }

  private _clearBaseCaches(): void {
    this._baseKeybindingsMap = new Map<LogicalKeybindingsName, KeybindingsSet>();
  }

  private _getKeybindingsExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getActiveExtensionMetadata()) {
      for (const st of extension.contributes.keybindings) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanKeybindingsDirectory(directory: string): KeybindingsFileInfo[] {
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
    const baseKeybindingsSet = this._getBaseKeybindingsSet(name);

    // Hash the custom bindings for speed purposes
    const customizations = this._getCustomKeybindingsFile(name);
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

  private _getBaseKeybindingsSet(name: LogicalKeybindingsName): KeybindingsSet {
    if (this._baseKeybindingsMap.has(name)) {
      return this._baseKeybindingsMap.get(name);
    }

    const flatKeybindings = new Map<string, KeybindingsBinding>();
    for (const fileInfo of this._getKeybindingsFileList()) {
      if (fileInfo.name === name) {
        const keybindingsFile = this._readKeybindingsFile(fileInfo);
        for (const binding of keybindingsFile.bindings) {
          flatKeybindings.set(binding.command, binding);
        }
      }
    }

    const result: KeybindingsSet = {
      extends: name,
      bindings: Array.from(flatKeybindings.values())
    };
    this._baseKeybindingsMap.set(name, result);

    return result;
  }

  private _readKeybindingsFile(fileInfo: KeybindingsFileInfo): KeybindingsSet {
    const fullPath = path.join(fileInfo.path, fileInfo.filename);
    const keyBindingJsonString = fs.readFileSync(fullPath, { encoding: "UTF8" } );
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
      keybindingsSet: this._getBaseKeybindingsSet(name),
      customKeybindingsSet: this._getCustomKeybindingsFile(name)
    };
  }

  private _getCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsSet {
    if (this._customKeybindingsMap.has(name)) {
      return this._customKeybindingsMap.get(name);
    }

    const customKeybindingsFile = this._readCustomKeybindingsFile(name);
    this._customKeybindingsMap.set(name, customKeybindingsFile);
    return customKeybindingsFile;
  }

  private _getCustomKeybindingsFilePath(name: LogicalKeybindingsName): string {
    return path.join(this._userPath, name + ".json");
  }

  private _readCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsSet {
    const filePath = this._getCustomKeybindingsFilePath(name);
    if ( ! fs.existsSync(filePath)) {
      return {
        basedOn: name,
        customBindings: []
      };
    }

    try {
      const contents = fs.readFileSync(filePath, { encoding: "UTF8" } );
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
    this._writeCustomKeybindingsFile(customKeybindingsFile);
    this._customKeybindingsMap.set(customKeybindingsFile.basedOn, customKeybindingsFile);
    this._clearBaseCaches();

    this._onUpdateEventEmitter.fire();
  }

  private _writeCustomKeybindingsFile(customKeybindingsFile: CustomKeybindingsSet): boolean {
    const filePath = this._getCustomKeybindingsFilePath(customKeybindingsFile.basedOn);
    try {
      fs.writeFileSync(filePath, JSON.stringify(customKeybindingsFile, null, "  "));
    } catch(err) {
      this._log.warn(`Unable to update '${filePath}'. Error: ${err.message}`);
      return false;
    }
    return true;
  }
}
