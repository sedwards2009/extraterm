/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
export { log } from "./LogDecorator";
export { Level, LogWriter, Logger, getLogger, objectName, addLogWriter } from "./Logger";
export { FileLogWriter } from "./FileLogWriter";
