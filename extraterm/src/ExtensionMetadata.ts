/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ExtensionMetadata {
  name: string;
  path: string;
  main: string;
  version?: string;
  description?: string;
  contributions: ExtensionContributions;
}

export interface ExtensionContributions {
  viewer: ExtensionViewerContribution[];
  sessionEditor: ExtensionSessionEditorContribution[];
}

export interface ExtensionViewerContribution {
  name: string;
  mimeTypes: string[];
  css: ExtensionCss;
}

export interface ExtensionCss {
  directory: string;
  cssFile: string[];
  fontAwesome: boolean;
}

export interface ExtensionSessionEditorContribution {
  /**
   * Human readable name for this session editor.
   */
  name: string;

  /**
   * Internal symbol used internally for indentifying this type of session.
   */
  type: string;
  css: ExtensionCss;
}
