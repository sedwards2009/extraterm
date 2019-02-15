"use strict";
/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 * Copyright (c) 2018, Microsoft Corporation (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
function assign(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) { return Object.keys(source).forEach(function (key) { return target[key] = source[key]; }); });
    return target;
}
exports.assign = assign;
function loadNative(moduleName) {
    try {
        return require(path.join('..', 'build', 'Release', moduleName + ".node"));
    }
    catch (_a) {
        return require(path.join('..', 'build', 'Debug', moduleName + ".node"));
    }
}
exports.loadNative = loadNative;
//# sourceMappingURL=utils.js.map