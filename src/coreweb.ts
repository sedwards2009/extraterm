/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

/**
 * Connection to the code running in the nodejs context. This should be
 * called by code running inside a window.
 */

///<reference path='./chrome_lib.d.ts'/>
///<reference path="./typings/node/node.d.ts" />
///<reference path="./typings/node-webkit/node-webkit.d.ts" />
///<amd-dependency path="nw.gui" />

var gui: typeof nw.gui = require('nw.gui');

import Config = require('config');
import Theme = require('theme');
import CoreNodeAPI = require('corenodeapi');

var coreNodeBackend = <CoreNodeAPI> ((<any>process).mainModule.exports);
coreNodeBackend.setDataPath(gui.App.dataPath);

export function getConfig(): Config {
  return coreNodeBackend.getConfig();
}

export function getThemesDirectory(): string {
  return coreNodeBackend.getThemesDirectory();  
}

export function getThemes(): Theme[] {
  return coreNodeBackend.getThemes();
}
