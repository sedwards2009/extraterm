/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import DEFAULT_SESSION_PROFILES = require('./defaultsessionprofiles');
import util = require('./gui/util');
import os = require('os');
import _ = require('lodash');

export interface Config {
  blinkingCursor?: boolean;
  theme?: string;
  themePath?: string;
  sessionProfiles?: SessionProfile[];
}

export interface SessionProfile {
  name: string;
  command?: string;
  extraEnv?: Object;
  platform?: string | string[]; // "win32", "linux" etc.
}

export function defaultSessionProfile(configSessionProfiles: SessionProfile[]): SessionProfile {
  const merged = mergeSessionProfiles(DEFAULT_SESSION_PROFILES, configSessionProfiles);
  const candidates = merged.filter( (sp) => {
    if (sp.platform === null || sp.platform === undefined) {
      return true;
    }
    return Array.isArray(sp.platform) ? sp.platform.indexOf(process.platform) !== -1 : sp.platform === process.platform;
  });
    
  return candidates.length !== 0 ? candidates[0] : null;
}

export function mergeSessionProfiles(primaryList: SessionProfile[], secondaryList: SessionProfile[]): SessionProfile[] {
  const resultList = <SessionProfile[]> _.cloneDeep(primaryList);
  if (secondaryList === null || secondaryList === undefined) {
    return resultList;
  }
  
  const nameMap = new Map<string, SessionProfile>();
  // FIXME there is probably a simpler way of doing this once ES6 support improves.
  secondaryList.forEach( (sp) => {
    nameMap.set(sp.name, sp);
  });
  
  resultList.forEach( (sp) => {
    if (nameMap.has(sp.name)) {
      // If the secondary list has a replacement or override for a a session profile, then process it now.
      const secondary = nameMap.get(sp.name);
      
      sp.command = util.override(sp.command, secondary.command);
      sp.platform = util.override(sp.platform, secondary.platform);
      
      if (secondary.extraEnv !== null && secondary.extraEnv !== undefined) {
        if (sp.extraEnv !== null || sp.extraEnv === undefined) {
          sp.extraEnv = {};
        }
        
        let prop: string;
        for (prop in secondary.extraEnv) {
          sp.extraEnv[prop] = secondary.extraEnv[prop];          
        }
      }
    }
    nameMap.delete(sp.name);
  });

  // Append any sessions in the secondary list which didn't appear in the primary.
  nameMap.forEach( (sp) => {
    resultList.splice(0,0, sp);
  });

  return resultList;
}

export function envContext(): Map<string, string> {
  const context = new Map<string, string>();
  /*context.set("HOME", os.homedir());*/
  console.log(context);
  return context;
}

export function expandEnvVariables(sessionProfile: SessionProfile, context: Map<string, string>): SessionProfile {
  const result = <SessionProfile> _.cloneDeep(sessionProfile);
  if (result.extraEnv !== null && result.extraEnv !== undefined) {
    let prop: string;
    for (prop in result.extraEnv) {
      result.extraEnv = expandEnvVariable(result.extraEnv[prop], context);
    }
  }
  
  return result;
}

export function expandEnvVariable(value: string, context: Object): string {
  let result = value;
  let prop: string;
  for (prop in context) {
    const re = new RegExp("${" + prop + "}", "g");
    result = result.replace(re, context[prop]);
  }
  return result;
}
