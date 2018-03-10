/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import {Logger, getLogger} from '../../logging/Logger';
import { ExtensionMetadata } from '../../ExtensionMetadata';
import * as WebIpc from '../WebIpc';


export class ExtensionLoader {

  private _log: Logger = null;
  private _extensionMetadata: ExtensionMetadata[] = [];

  constructor(private extensionPaths: string[]) {
    this._log = getLogger("ExtensionLoader", this);
  }

  startUp(): void {
    this._extensionMetadata = WebIpc.requestExtensionMetadataSync();
  }

  getExtensionMetadata(): ExtensionMetadata[] {
    return this._extensionMetadata;
  }

  setExtensionMetadata(extensionMetadata: ExtensionMetadata[]): void {
    this._extensionMetadata = extensionMetadata;
  }

  load(extension: ExtensionMetadata): boolean {
    if (extension.module !== null) {
      return true;
    }
    
    const mainJsPath = path.join(extension.path, extension.main);
    try {
      const module = require(mainJsPath);
      extension.module = module;
      return true;
    } catch(ex) {
      this._log.warn(`Unable to load ${mainJsPath}. ${ex}`);
      return false;
    }
  }
}
