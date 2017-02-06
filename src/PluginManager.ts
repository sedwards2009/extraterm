/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs = require('fs');
import path = require('path');
import Logger = require('./logger');
import PluginApi = require('./PluginApi');

const PLUGIN_METADATA = "metadata.json";

// Partial because people forget to fill in json files correctly.
type PartialPluginMetaData = {
  [P in keyof PluginApi.PluginMetaData]?: PluginApi.PluginMetaData[P];
}

interface PluginInfo {
  path: string;
  name: string;
  factoryName: string;  
  instance: PluginApi.ExtratermPlugin;
}

export class PluginManager {

  private _log: Logger = null;

  private _pluginDir: string = null;

  private _pluginData: PluginInfo[] = [];

  constructor(pluginDir: string) {
    this._log = new Logger("PluginManager", this);
    this._pluginDir = pluginDir;
  }

  /**
   * Load all of the plugins and create instances.
   * 
   * @param api the API instance to pass to the plugins at creation time.
   */
  load(api: PluginApi.ExtratermApi): void {
    this._pluginData = this._scan(this._pluginDir);

    for (const pluginData of this._pluginData) {
      const factory = this._loadPlugin(pluginData);
      pluginData.instance = factory(api);
    }
  }

  private _loadPlugin(pluginData: PluginInfo): PluginApi.ExtratermPluginFactory {
    const factoryPath = path.join(pluginData.path, pluginData.factoryName);
    return <PluginApi.ExtratermPluginFactory> require(factoryPath);
  }

  /**
   * Scan a directory for available plugins.
   * 
   * @param pluginDir the directory to scan.
   * @return list of plugin info describing what was found.
   */
  private _scan(pluginDir: string): PluginInfo[] {
    const result: PluginInfo[] = [];

    if (fs.existsSync(pluginDir)) {
      const contents = fs.readdirSync(pluginDir);
      for (const item of contents) {
        const metadataPath = path.join(pluginDir, item, PLUGIN_METADATA);

        if (fs.existsSync(metadataPath)) {
          const metadataString = fs.readFileSync(metadataPath, "UTF8");
          try {
            const metadata = <PartialPluginMetaData> JSON.parse(metadataString);
            if (metadata.name == null || metadata.factory == null) {
              this._log.warn(`An error occurred while reading the metadata from ${metadataPath}. It is missing 'name' or 'factory' fields.`);
            } else {
              result.push( { path: path.join(pluginDir, item), name: metadata.name, factoryName: metadata.factory, instance: null } );
            }

          } catch(ex) {
            this._log.warn(`An error occurred while processing ${metadataPath}.`, ex);
          }
        } else {
          this._log.warn(`Couldn't find a ${PLUGIN_METADATA} file in ${item}. Ignoring.`);
        }
      }
    }
    return result;
  }
}

