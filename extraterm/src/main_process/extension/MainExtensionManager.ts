/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Logger, getLogger } from "../../logging/Logger";
import { ExtensionContributions, ExtensionMetadata, ExtensionViewerContribution } from "../../ExtensionMetadata";
import { parsePackageJson } from './PackageFileParser';


export class MainExtensionManager {

  private _log: Logger = null;
  private _extensionMetadata: ExtensionMetadata[] = [];

  constructor(private extensionPaths: string[]) {
    this._log = getLogger("MainExtensionManager", this);
  }

  scan(): void {
    this._extensionMetadata = _.flatten(this.extensionPaths.map(p => this._scanPath(p)));
  }

  getExtensionMetadata(): ExtensionMetadata[] {
    return this._extensionMetadata;
  }

  private _scanPath(extensionPath: string): ExtensionMetadata[] {
    if (fs.existsSync(extensionPath)) {
      const result: ExtensionMetadata[] = [];
      const contents = fs.readdirSync(extensionPath);
      for (const item of contents) {
        const packageJsonPath = path.join(extensionPath, item, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          const extensionInfo = this._loadPackageJson(path.join(extensionPath, item));
          if (extensionInfo !== null) {
            result.push(extensionInfo);
            this._log.info(`Read extension metadata from '${extensionInfo.name}'.`);
          }
        } else {
          this._log.warn(`Unable to read ${packageJsonPath}, skipping`);
        }
      }
      return result;

    } else {
      this._log.warn(`Extension path ${extensionPath} doesn't exist.`);
      return [];
    }
  }

  private _loadPackageJson(extensionPath: string): ExtensionMetadata {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJsonString = fs.readFileSync(packageJsonPath, "UTF8");
    try {
      const packageJson = JSON.parse(packageJsonString);
      const result = parsePackageJson(packageJson, packageJsonPath);
      return result;
    } catch(ex) {
      this._log.warn("An error occurred while processing '${packageJsonPath}': " + ex);
      return null;
    }
  }
}
