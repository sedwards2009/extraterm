/*
 * Copyright 2018 Nick Shanny <nshanny@shannymusings.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Parse an argument string into an array of args following these simple rules:
 * 
 * Split spaces into an array, and supporting double and single quotes and nothing else, just the minimum. 
 * Then people can quote their strings which contain spaces and it will mostly work as they expect.
 * Single and double quotes will not be removed. 
 *
 * @return string[] of arguments.
 */

export function ShellStringParser(args: string): string[] {
  let arr: string[] = [];

  if (args !== undefined) {
    let splitArgs = args.split (" ");
    let joiningElements = false;
    let joinedArg = '';

    for (let i = 0; i < splitArgs.length; i++) {

      if (splitArgs[i].startsWith("'") || splitArgs[i].startsWith('"')) {
        joinedArg = splitArgs[i];
        joiningElements = true;
      } else if (joiningElements === true) {
        joinedArg += (' ' + splitArgs[i]);

        // End with the same quote we started with
        if (splitArgs[i].endsWith(joinedArg[0])) {
          // Remove the surrounding quotes
          arr.push(joinedArg.slice(1, joinedArg.length - 1));
          joiningElements = false;
          joinedArg = '';
        }
      } else {
        arr.push (splitArgs[i]);
      }
    }

    // Deal with final case
    if (joinedArg.length > 0) {
      if (joinedArg.endsWith(joinedArg[0])) {
        joinedArg = joinedArg.slice(1, joinedArg.length - 1);
      }
      arr.push(joinedArg);
    }
  }

  return arr;
}
