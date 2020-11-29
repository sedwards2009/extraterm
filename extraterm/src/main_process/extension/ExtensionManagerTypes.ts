/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import { ExtensionMetadata, ExtensionSessionBackendContribution } from "../../ExtensionMetadata";
import { SessionBackend, SyntaxThemeProvider, TerminalThemeProvider } from "@extraterm/extraterm-extension-api";


export interface LoadedSessionBackendContribution {
  metadata: ExtensionMetadata;
  sessionBackendMetadata: ExtensionSessionBackendContribution;
  sessionBackend: SessionBackend;
}

export interface LoadedSyntaxThemeProviderContribution {
  metadata: ExtensionMetadata;
  syntaxThemeProvider: SyntaxThemeProvider;
}

export interface LoadedTerminalThemeProviderContribution {
  metadata: ExtensionMetadata;
  terminalThemeProvider: TerminalThemeProvider;
}
