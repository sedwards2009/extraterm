/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import Logger = require('./logger');

/**
 * Decorator to log method calls.
 * 
 * @param  {Object} target     [description]
 * @param  {string} key        [description]
 * @param  {any}    descriptor [description]
 * @return {[type]}            [description]
 */
function log(target: Object, key: string, descriptor: any) {
  const originalMethod = descriptor.value; 

  descriptor.value =  function (...args: any[]) {
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

export = log;
