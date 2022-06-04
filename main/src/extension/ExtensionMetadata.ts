/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ExtensionMetadata {
  readonly name: string;
  readonly path: string;
  readonly exports?: string;
  readonly version?: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly keywords?: string[];
  readonly displayName?: string;
  readonly contributes: ExtensionContributes;
  readonly includePlatform?: ExtensionPlatform[];
  readonly excludePlatform?: ExtensionPlatform[];
  readonly isInternal?: boolean;
  readonly readmePath?: string;
}

export interface ExtensionPlatform {
  readonly os?: string;
  readonly arch?: string;
}

export interface ExtensionContributes {
  readonly commands: ExtensionCommandContribution[];
  readonly keybindings: ExtensionKeybindingsContribution[];
  readonly menus: ExtensionMenusContribution;
  readonly sessionBackends: ExtensionSessionBackendContribution[];
  readonly sessionEditors: ExtensionSessionEditorContribution[];
  readonly sessionSettings: ExtensionSessionSettingsContribution[];
  readonly tabs: ExtensionTabContribution[];
  readonly tabTitleWidgets: ExtensionTabTitlesWidgetContribution[];
  readonly terminalBorderWidgets: ExtensionTerminalBorderContribution[];
  readonly terminalThemes: ExtensionTerminalThemeContribution[];
  readonly terminalThemeProviders: ExtensionTerminalThemeProviderContribution[];
  readonly viewers: ExtensionViewerContribution[];
}

export type Category = "global" |
                        "application" |
                        "window" |
                        "terminal" |
                        "hyperlink" |
                        "viewer";

export interface WhenVariables {
  true: boolean;
  false: boolean;
  terminalFocus: boolean;
  connectedTerminalFocus: boolean;
  viewerFocus: boolean;
  isHyperlink: boolean;
  hyperlinkURL: string;
  hyperlinkProtocol: string;
  hyperlinkDomain: string;
  hyperlinkFileExtension: string;
}

export interface ExtensionCommandContribution {
  readonly command: string;
  readonly title: string;
  readonly when?: string;
  readonly category?: Category;
  readonly order?: number;
  readonly icon?: string;
  readonly checked?: boolean;
}

export interface ExtensionViewerContribution {
  readonly name: string;
  readonly mimeTypes: string[];
}

export interface ExtensionSessionEditorContribution {
  readonly name: string;
  readonly type: string;
}

export interface ExtensionSessionBackendContribution {
  readonly name: string;
  readonly type: string;
}

export interface ExtensionSessionSettingsContribution {
  readonly id: string;
  readonly name: string;
}

export type BorderDirection = "north" | "south" | "east" | "west";

export interface ExtensionTabTitlesWidgetContribution {
  readonly name: string;
}

export interface ExtensionTerminalBorderContribution {
  readonly name: string;
  readonly border: BorderDirection;
}

export interface ExtensionTerminalThemeProviderContribution {
  readonly name: string;
  readonly humanFormatNames: string[];
}

export interface ExtensionTerminalThemeContribution {
  readonly path: string;
}

export interface ExtensionKeybindingsContribution {
  readonly path: string;
}

export interface ExtensionMenusContribution {
  readonly contextMenu: ExtensionMenu[];
  readonly commandPalette: ExtensionMenu[];
  readonly newTerminal: ExtensionMenu[];
  readonly terminalTab: ExtensionMenu[];
  readonly windowMenu: ExtensionMenu[];
}

export interface ExtensionMenu {
  readonly command: string;
  readonly show: boolean;
}

export interface ExtensionDesiredState {
  [extensionName: string]: boolean;
}

export interface ExtensionTabContribution {
  readonly name: string;
}
