/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

const TRIM_REGEX = />\s*</gm;

/**
 * Trim whitespace from between tags in a HTML template string.
 * @param inputString the template string to trim
 * @return The newly trimed string.
 */
export function trimBetweenTags(inputString: string): string {
  return inputString.replace(TRIM_REGEX, "><");
}
