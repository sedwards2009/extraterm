/*
 * Copyright 2018 Nick Shanny <nshanny@mac.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Parse an argument string into an array of args following these simple rules:
 * 
 * Split spaces into an array, and supporting double and single quotes and nothing else, just the minimum. 
 * Then people can quote their strings which contain spaces and it will mostly work as they expect.
 *
 * @return string[] of arguments.
 */

function charactersToStrip(element: string, index: number, array: string[]) {
  return (element !== ' ' && element !== '');
}

export function shell_string_parser(args: string): string[] {
  let arr: string[] = [];

  if (args !== undefined) {
    arr = args.split(/('.*?'|".*?"|\S+)/g).filter(charactersToStrip);
  }

  return arr;
}
