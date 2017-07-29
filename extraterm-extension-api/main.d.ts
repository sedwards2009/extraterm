/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * A resource which can later be freed by calling `dispose()`.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Function which represents a specific event which you can subscribe to.
 */
export interface Event<T> {
  (listener: (e: T) => any): Disposable;
}

export interface Terminal {
  write(text: string): void;
}


export interface TextViewer {
  // getCodeMirror();
}


/**
 * Defines a command for display in the Command Palette.
 */
export interface CommandEntry {
  /**
   * Name of this command. This name is used internally and should only
   * consist of alphanumeric characters ([A-Z0-9]+). It must be unique
   * to this extension and stable between calls.
   */
  commandId: string;

  group: string;
  iconLeft?: string;
  iconRight?: string;

  /**
   * Label for this command. This string is shown in the Command Palette to
   * the user.
   */
  label: string;

   /**
    * Optional object which will be passed to the command executor when this
    * command is run.
    */
  commandArguments?: object;
}


export interface Workspace {

  getTerminals(): Terminal[];

  onDidCreateTerminal: Event<Terminal>;

  // onWillDestroyTerminal: Event<Terminal>;
  registerCommandsOnTextViewer(
    commandLister: (textViewer: TextViewer) => CommandEntry[],
    commandExecutor: (textViewer: TextViewer, commandId: string, commandArguments?: object) => void): Disposable;
}

export interface ExtensionContext {
  workspace: Workspace;

}

/**
 * An extension module as viewed from Extraterm.
 */
export interface ExtensionModule {

  /**
   * Each extension module must export a functioncalled `activate()` with signature below.
   * 
   * @param context The extension context which this extension is running in.
   * @return The public API of this extension, or null or undefined.
   */
  activate(context: ExtensionContext): any;
}
