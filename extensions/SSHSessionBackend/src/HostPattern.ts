/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export class HostPattern {

  #isNegative: boolean;
  #regex: RegExp;

  constructor(pattern: string) {
    this.#isNegative = false;
    this.#convertPattern(pattern);
  }

  #convertPattern(pattern: string): void {
    if (pattern.startsWith("!")) {
      this.#isNegative = true;
      pattern = pattern.substring(1);
    }

    // Convert the pattern to a regex
    // * should be a wild card and match anything text.
    // ? is wild card which matches 1 character.
    // Make sure other regex characters are escaped.
    const regexPattern = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
      .replace(/\\\*/g, ".*").replace(/\\\?/g, ".");
    this.#regex = new RegExp(`^${regexPattern}$`, "i");
  }

  isNegative(): boolean {
    return this.#isNegative;
  }

  match(host: string): boolean {
    return this.#regex.test(host);
  }
}
