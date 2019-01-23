/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

export interface TextEditor {
  executeAceCommand(command: string): void;
  getEditable(): boolean;
}
