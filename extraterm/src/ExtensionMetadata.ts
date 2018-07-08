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
  includePlatform?: ExtensionPlatform[];
  excludePlatform?: ExtensionPlatform[];
}

export interface ExtensionPlatform {
  os?: string;
  arch?: string;
}

export interface ExtensionContributions {
  viewer: ExtensionViewerContribution[];
  sessionEditor: ExtensionSessionEditorContribution[];
  sessionBackend: ExtensionSessionBackendContribution[];
  syntaxThemeProvider: ExtensionSyntaxThemeProviderContribution[]
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

export interface ExtensionSessionBackendContribution {
  /**
   * Human readable name for this session editor.
   */
  name: string;

  /**
   * Internal symbol used internally for indentifying this type of session.
   */
  type: string;
}

export interface ExtensionSyntaxThemeProviderContribution {
  name: string;
}
