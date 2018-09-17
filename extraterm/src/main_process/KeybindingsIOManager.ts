/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';

import {Logger, getLogger, log} from "extraterm-logging";

import { MainExtensionManager } from './extension/MainExtensionManager';
import { KeybindingsInfo } from '../Config';


export class KeybindingsIOManager {

  private _log: Logger = null;
  private _keybindingsList: KeybindingsInfo[] = [];

  constructor(private _userPaths: string[], private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("KeybindingsIOManager", this);
  }

  scan(): void {
    this._keybindingsList = this._scanAll();

    for (const x of this._keybindingsList) {
      this._log.debug(`{filename: ${x.filename}, path: ${x.path}, name: ${x.name}}`);
    }
  }

  private _scanAll(): KeybindingsInfo[] {
    const userInfoLists = this._userPaths.map(p => this._scanKeybindingsDirectory(p, false));
    const extensionInfoLists = this._getKeybindingsExtensionPaths().map(p => this._scanKeybindingsDirectory(p, true));
    const infoLists = [...userInfoLists, ...extensionInfoLists];
    return infoLists.reduce( (list, accu) => [...list, ...accu], []);
  }

  private _getKeybindingsExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getExtensionMetadata()) {
      for (const st of extension.contributions.keybindings) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanKeybindingsDirectory(directory: string, readOnly: boolean): KeybindingsInfo[] {
    const result: KeybindingsInfo[] = [];
    if (fs.existsSync(directory)) {
      const contents = fs.readdirSync(directory);
      contents.forEach( (item) => {
        if (item.endsWith(".json")) {
          const name = item.slice(0, -5);
          const info: KeybindingsInfo = {
            name: name,
            filename: item,
            readOnly,
            path: directory
          };
          result.push(info);
        }
      });
    }
    return result;
  }

  getInfoList(): KeybindingsInfo[] {
    return this._keybindingsList;
  }

  hasKeybindingsFilename(name: string): boolean {
    return this._getInfoByFilename(name) != null;
  }

  private _getInfoByFilename(name: string): KeybindingsInfo {
    for (const info of this._keybindingsList) {
      if (info.filename === name) {
        return info;
      }
    }
    return null;
  }

  loadKeybindingsJson(filename: string): object {
    const info = this._getInfoByFilename(filename);
    const fullPath = path.join(info.path, info.filename);
    const keyBindingJsonString = fs.readFileSync(fullPath, { encoding: "UTF8" } );
    const keyBindingsJSON = JSON.parse(keyBindingJsonString);
    return keyBindingsJSON;
  }
}
