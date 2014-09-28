/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<reference path='./chrome_lib.d.ts'/>

import Config = require('config');
import Theme = require('theme');

interface CoreNodeAPI {
  setDataPath(path: string): void;
  getConfig(): Config;
  getThemesDirectory(): string;
  getThemes(): Theme[];
}
export = CoreNodeAPI;
