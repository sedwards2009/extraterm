/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import util = require('./gui/util');
import os = require('os');
import _ = require('lodash');

export interface Config {
  blinkingCursor?: boolean;
  themeTerminal?: string;
  themeSyntax?: string;
  themeGUI?: string;

  commandLineActions?: CommandLineAction[];
  scrollbackLines?: number;

  sessionProfiles?: SessionProfile[]; // User configurable list of sessions.
  expandedProfiles: SessionProfile[]; // 'cooked' or expanded list of sessions where missing information is filled in.
  systemConfig: SystemConfig;
}

export type CommandLineActionMatchType = 'name' | 'regexp';

export interface CommandLineAction {
  match: string;
  matchType: CommandLineActionMatchType;
  frame: boolean;
}

export interface SystemConfig {
  homeDir: string;
}

export const SESSION_TYPE_UNIX = "unix";
export const SESSION_TYPE_CYGWIN = "cygwin";
export const SESSION_TYPE_BABUN = "babun";

export interface SessionProfile {
  name: string;             // Human readable name for the profile.
  type?: string;            // type - "cygwin", "babun" or "native" ("" means "native")
  command?: string;         // the command to execute in the terminal
  arguments?: string[];     // the arguments for said command
  extraEnv?: Object;        // extra entries to add to the environment before running the command.
  cygwinDir?: string;       // The directory holding the 'system'. Used by babun and cygwin.
}

export function envContext(systemConfig: SystemConfig): Map<string, string> {
  const context = new Map<string, string>();
  context.set("HOME_DIR", systemConfig.homeDir);
  return context;
}

export function expandEnvVariables(extraEnv: Object, context: Map<string, string>): Object {
  const expandedEnv = {};
  if (extraEnv !== null && extraEnv !== undefined) {
    let prop: string;
    for (prop in extraEnv) {
      expandedEnv[prop] = expandEnvVariable(extraEnv[prop], context);
    }
  }

  return expandedEnv;
}

export function expandEnvVariable(value: string, context: Map<string, string>): string {
  let result = value;
  let prop: string;
  context.forEach( (value, prop) => {
    const re = new RegExp("\\$\\{" + prop + "\\}", "g");
    result = result.replace(re, value);
  });
  return result;
}
