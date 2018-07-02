/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Logger, objectName} from './Logger';

/**
 * Decorator to log method calls.
 * 
 * @param  {Object} target     [description]
 * @param  {string} key        [description]
 * @param  {any}    descriptor [description]
 * @return {[type]}            [description]
 */
export function log(target: Object, key: string, descriptor: any) {
  const originalMethod = descriptor.value; 

  descriptor.value =  function (this: any, ...args: any[]) {
      var formatArgs = args.map(repr).join(", ");

      if ("_log" in this) {
        const logger = <Logger>this._log;
        logger.debug(`\u2b9e Entering ${key}(${formatArgs})`);
        var result = originalMethod.apply(this, args);
        logger.debug(`\u2b9c Exiting ${key}(${formatArgs}) => ${repr(result)}`);
         
      } else {
        console.log(`\u2b9e Entering ${key}(${formatArgs})`);
        var result = originalMethod.apply(this, args);
        console.log(`\u2b9c Exiting ${key}(${formatArgs}) => ${repr(result)}`);
      }
      return result;
  }
  return descriptor;
}

function repr(obj: any): string {
  if (obj === undefined) {
    return "undefined";
  }
  if (obj === null) {
    return "null";
  }

  const name = objectName(obj);
  if (name != null) {
    return name;
  }
  
  try {
    if (HTMLElement !== undefined) {
      if (obj instanceof HTMLElement) {
        return "<" + (<HTMLElement> obj).tagName + ">";
      }
    }
  } catch(e) {
    // Ignore. This blows up outside the browser environment.
  }

  switch (typeof obj) {
    case "number":
      return "" + obj;
    case "string":
      return '"' + obj  + '"';
    case "boolean":
      return "" + obj;
    default:
      return "object";
  }
}
