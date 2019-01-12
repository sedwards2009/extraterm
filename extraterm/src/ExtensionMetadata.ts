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
  contributes: ExtensionContributes;
  includePlatform?: ExtensionPlatform[];
  excludePlatform?: ExtensionPlatform[];
}

export interface ExtensionPlatform {
  os?: string;
  arch?: string;
}

export interface ExtensionContributes {
  commands: ExtensionCommandContribution[];
  keybindings: ExtensionKeybindingsContribution[];
  sessionBackends: ExtensionSessionBackendContribution[];
  sessionEditors: ExtensionSessionEditorContribution[];
  syntaxThemes: ExtensionSyntaxThemeContribution[];
  syntaxThemeProviders: ExtensionSyntaxThemeProviderContribution[];
  terminalThemes: ExtensionTerminalThemeContribution[];
  terminalThemeProviders: ExtensionTerminalThemeProviderContribution[];
  viewers: ExtensionViewerContribution[];
}

  // commands: ExtensionCommandContribution[];
export interface ExtensionCommandContribution {
  command: string;
  title: string;
  when?: string;
  commandPalette?: boolean;
  contextMenu?: boolean;
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
   * Symbol used internally for identifying this type of session.
   */
  type: string;
}

export interface ExtensionSyntaxThemeProviderContribution {
  /**
   * Internal name for this provider.
   */
  name: string;

  humanFormatNames: string[];
}

export interface ExtensionSyntaxThemeContribution {
  path: string;
}

export interface ExtensionTerminalThemeProviderContribution {
  /**
   * Internal name for this provider.
   */
  name: string;

  humanFormatNames: string[];
}

export interface ExtensionTerminalThemeContribution {
  path: string;
}

export interface ExtensionKeybindingsContribution {
  path: string;
}
