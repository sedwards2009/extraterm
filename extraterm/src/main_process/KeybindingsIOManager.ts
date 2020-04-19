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
import { KeybindingsFile, AllLogicalKeybindingsNames, LogicalKeybindingsName, KeybindingsFileBinding, StackedKeybindingsFile, CustomKeybindingsFile } from '../keybindings/KeybindingsFile';
import { EventEmitter } from '../utils/EventEmitter';
import { Event } from '@extraterm/extraterm-extension-api';


export class KeybindingsIOManager {

  private _log: Logger = null;
  private _keybindingsFileList: KeybindingsFileInfo[] = null;
  private _flatKeybindingMap: Map<LogicalKeybindingsName, KeybindingsFile> = null;
  private _customKeybindingsMap: Map<LogicalKeybindingsName, CustomKeybindingsFile> = null;

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
    this._flatKeybindingMap = new Map<LogicalKeybindingsName, KeybindingsFile>();
    this._customKeybindingsMap = new Map<LogicalKeybindingsName, CustomKeybindingsFile>();
    this._keybindingsFileList = null;
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

  @log
  getFlatKeybindingsFile(name: LogicalKeybindingsName): KeybindingsFile {
    const result = this._getFlatBaseKeybindingsFile(name);
    this._log.debug(`getFlatKeybindingsFile() result.bindings.length: ${result.bindings.length}`);
    return result;
  }

  private _getFlatBaseKeybindingsFile(name: LogicalKeybindingsName): KeybindingsFile {
    if (this._flatKeybindingMap.has(name)) {
      return this._flatKeybindingMap.get(name);
    }

    const flatKeybindings = new Map<string, KeybindingsFileBinding>();
    for (const fileInfo of this._getKeybindingsFileList()) {
      if (fileInfo.name === name) {
        const keybindingsFile = this._readKeybindingsFile(fileInfo);
        for (const binding of keybindingsFile.bindings) {
          flatKeybindings.set(binding.command, binding);
        }
      }
    }

    return {
      extends: name,
      bindings: Array.from(flatKeybindings.values())
    };
  }

  private _readKeybindingsFile(fileInfo: KeybindingsFileInfo): KeybindingsFile {
    const fullPath = path.join(fileInfo.path, fileInfo.filename);
    const keyBindingJsonString = fs.readFileSync(fullPath, { encoding: "UTF8" } );
    let keyBindingsJSON: KeybindingsFile = JSON.parse(keyBindingJsonString);

    if (keyBindingsJSON == null) {
      keyBindingsJSON = { extends: name, bindings: [] };
    }
    if (keyBindingsJSON.bindings == null) {
      keyBindingsJSON.bindings = [];
    }
    return keyBindingsJSON;
  }

  getStackedKeybindings(name: LogicalKeybindingsName): StackedKeybindingsFile {
    return {
      name,
      keybindingsFile: this._getFlatBaseKeybindingsFile(name),
      customKeybindingsFile: this._getCustomKeybindingsFile(name)
    };
  }

  private _getCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsFile {
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

  private _readCustomKeybindingsFile(name: LogicalKeybindingsName): CustomKeybindingsFile {
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

  updateCustomKeybindingsFile(customKeybindingsFile: CustomKeybindingsFile): void {

  }

  // updateKeybindings(name: string, data: KeybindingsFile): boolean {
  //   const info = this._getInfoByName(name);
  //   if (info == null) {
  //     this._log.warn(`Unable to find keybindings file '${name}'`);
  //     return false;
  //   }

  //   const destPath = path.join(info.path, info.filename);
  //   try {
  //     fs.writeFileSync(destPath, JSON.stringify(data, null, "  "));
  //   } catch(err) {
  //     this._log.warn(`Unable to update '${destPath}'. Error: ${err.message}`);
  //     return false;
  //   }

  //   this._onUpdateEventEmitter.fire(name);
  //   return true;
  // }
}
