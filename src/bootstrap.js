/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

// Bridge nodejs and its require with our AMD style compiled TypeScript code.
var requirejs = require('requirejs');

requirejs.config({
  nodeRequire: require,
  baseUrl: '',
  map: {
    "*": {
      "corenode" : "build_js/corenode.js",
    }
  }
});

var corenode = requirejs('corenode');
var corenodeapi = corenode.run(__dirname);

exports.setDirname = corenodeapi.setDirname;
exports.setDataPath = corenodeapi.setDataPath;
exports.getConfig = corenodeapi.getConfig;
exports.getThemesDirectory = corenodeapi.getThemesDirectory;
exports.getThemes = corenodeapi.getThemes;
