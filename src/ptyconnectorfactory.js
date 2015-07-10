/**
 * Select the correct pty connector factory based on the OS platform we're running on.
 *
 * Note: This file isn't compiled from TS. It just is.
 */
exports.factory = require(process.platform === "win32" ? "./ptyproxy" : "./ptydirect").factory;
