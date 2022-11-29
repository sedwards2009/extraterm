/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface CustomizedCommand {
  title?: string;
  checked?: boolean;
}

export interface Commands {
  /**
   * Register the function to handle a command.
   *
   * @param name the name of the command as specified in the `package.json` contributes/commands section.
   * @param commandFunc the function to execute when the command is selected.
   * @param customizer an optional function to customize the title or state of the command.
   */
  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => (CustomizedCommand | null)): void;

  /**
   * Execute a command by name.
   *
   * @param name the full name of the command.
   * @param args arguments for the command.
   * @returns an optional return value.
   */
  executeCommand<T>(name: string, args?: any): Promise<T> | null;

  /**
   * A list of all available commands.
   */
  readonly commands: string[];
}
