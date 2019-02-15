/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 * Copyright (c) 2018, Microsoft Corporation (MIT License).
 */

import * as path from 'path';

export function assign(target: any, ...sources: any[]): any {
  sources.forEach(source => Object.keys(source).forEach(key => target[key] = source[key]));
  return target;
}

export function loadNative(moduleName: string): any {
  try {
    return require(path.join('..', 'build', 'Release', `${moduleName}.node`));
  } catch {
    return require(path.join('..', 'build', 'Debug', `${moduleName}.node`));
  }
}
