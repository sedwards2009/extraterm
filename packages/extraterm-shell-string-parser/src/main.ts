/*
 * Copyright 2018 Nick Shanny <nshanny@shannymusings.com>
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

 enum ParserState {
  GROUND,
  RAW_STRING,
  SINGLE_QUOTE_STRING,
  DOUBLE_QUOTE_STRING,
}

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
  if (args == null) {
    return [];
  }

  const END_OF_STRING = "\x00";
  let state = ParserState.GROUND;
  const result: string[] = [];
  let accuString = "";
  for (let i=0; i<=args.length; i++) {
    const c = i !== args.length ? args[i] : END_OF_STRING;

    switch(state) {
      case ParserState.GROUND:
        switch (c) {
          case "'":
            accuString = "";
            state = ParserState.SINGLE_QUOTE_STRING;
            break;
          case '"':
            accuString = "";
            state = ParserState.DOUBLE_QUOTE_STRING;
            break;
          case " ":
          case END_OF_STRING:
            break;
          default:
            accuString = c;
            state = ParserState.RAW_STRING;
            break;
        }
        break;

      case ParserState.RAW_STRING:
        switch (c) {
          case END_OF_STRING:
          case " ":
            result.push(accuString);
            accuString = "";
            state = ParserState.GROUND;
            break;
          default:
            accuString = accuString + c;
            state = ParserState.RAW_STRING;
            break;
        }
        break;

      case ParserState.SINGLE_QUOTE_STRING:
        switch (c) {
          case END_OF_STRING:
            accuString = "'" + accuString;
            result.push(accuString);
            break;
          case "'":
            result.push(accuString);
            accuString = "";
            state = ParserState.GROUND;
            break;
          default:
            accuString = accuString + c;
            break;
        }
        break;

      case ParserState.DOUBLE_QUOTE_STRING:
        switch (c) {
          case END_OF_STRING:
            accuString = '"' + accuString;
            result.push(accuString);
            break;
          case '"':
            result.push(accuString);
            accuString = "";
            state = ParserState.GROUND;
            break;
          default:
            accuString = accuString + c;
            break;
        }
        break;
    }
  }

  return result;
}