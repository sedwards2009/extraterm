/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Select the correct pty connector factory based on the OS platform we're running on.
 *
 * Note: This file isn't compiled from TS. It just is.
 */
exports.factory = require(process.platform === "win32" ? "./PtyProxy" : "./ptydirect").factory;
