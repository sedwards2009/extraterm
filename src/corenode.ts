/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<reference path='./chrome_lib.d.ts'/>
///<reference path="./typings/node/node.d.ts" />
///<reference path="./typings/node-webkit/node-webkit.d.ts" />
///<reference path="./typings/lodash/lodash.d.ts" />
///<reference path="./node_modules/immutable/dist/immutable.d.ts" />

import path = require('path');
import fs = require('fs');
import Config = require('config');
import im = require('immutable');
import Theme = require('./theme');
import CoreNodeAPI = require('corenodeapi');
import _ = require('lodash');

var CONFIG_FILENAME = "config";
var THEME_CONFIG = "theme.json";
var THEMES_DIRECTORY = "themes";

var themes: im.Map<string, Theme>;
var config: Config;
var dataPath: string = null;
var __dirname: string = null;

function setDataPath(path: string): void {
  if (dataPath === null) {
    dataPath = path;
    init();
  }
}

/**
 * Initialize and read in the configuration.
 */
function init(): void {
  config = readConfigurationFile();
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;

  // Themes
  var themesdir = path.join(__dirname, THEMES_DIRECTORY);
  themes = scanThemes(themesdir);
  if (themes.get(config.theme) === undefined) {
    config.theme = "default";
  }
}

/**
 * Read the configuration.
 * 
 * @returns {Object} The configuration object.
 */
function readConfigurationFile(): Config {
  var filename = path.join(dataPath, CONFIG_FILENAME);
  var config: Config = {};

  if (fs.existsSync(filename)) {
    var configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  }
  return config;
}

/**
 * Write out the configuration to disk.
 * 
 * @param {Object} config The configuration to write.
 */
function writeConfiguration(config: Config): void {
  var filename = path.join(dataPath, CONFIG_FILENAME);
  fs.writeFileSync(filename, JSON.stringify(config));
}

/**
 * Scan for themes.
 * 
 * @param themesdir The directory to scan for themes.
 * @returns Map of found theme config objects.
 */
function scanThemes(themesdir: string): im.Map<string, Theme> {
  var thememap = im.Map<string, Theme>();
  if (fs.existsSync(themesdir)) {
    var contents = fs.readdirSync(themesdir);
    contents.forEach(function(item) {
      var infopath = path.join(themesdir, item, THEME_CONFIG);
      try {
        var infostr = fs.readFileSync(infopath, {encoding: "utf8"});
        var themeinfo = <Theme>JSON.parse(infostr);

        if (validateThemeInfo(themeinfo)) {
          thememap = thememap.set(item, themeinfo);
        }

      } catch(err) {
        console.log("Warning: Unable to read file ",infopath);
      }
    });
    return thememap;
  }
}

/**
 * 
 */
function validateThemeInfo(themeinfo: Theme): boolean {
  return _.isString(themeinfo.name) && themeinfo.name !== "";
}

function getConfig(): Config {
  return config;
}

function getThemes(): Theme[] {
  return themes.toArray();
}

export function run(dirname: string): CoreNodeAPI {
  __dirname = dirname;
  var api: CoreNodeAPI = {
    setDataPath: setDataPath,
    getConfig: getConfig,
    getThemesDirectory: () => THEMES_DIRECTORY,
    getThemes: getThemes
  };
  return api;
}
