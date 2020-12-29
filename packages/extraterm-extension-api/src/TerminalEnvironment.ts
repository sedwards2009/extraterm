/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "extraterm-event-emitter";


export const TerminalEnvironment = {
  TERM_TITLE: "term:title",
  TERM_ROWS: "term:rows",
  TERM_COLUMNS: "term:columns",
  EXTRATERM_CURRENT_COMMAND: "extraterm:current_command",
  EXTRATERM_LAST_COMMAND: "extraterm:last_commmand",
  EXTRATERM_CURRENT_COMMAND_LINE: "extraterm:current_command_line",
  EXTRATERM_LAST_COMMAND_LINE: "extraterm:last_commmand_line",
  EXTRATERM_EXIT_CODE: "extraterm:exit_code",
};

export interface TerminalEnvironment {
  get(key: string): string;
  has(key: string): boolean;
  set(key: string, value: string): void;
  setList(list: {key: string, value: string}[]): void;

  [Symbol.iterator](): IterableIterator<[string, string]>;
  entries(): IterableIterator<[string, string]>;

  onChange: Event<string[]>;
}
