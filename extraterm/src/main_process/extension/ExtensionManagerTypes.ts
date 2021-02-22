/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import { ExtensionMetadata, ExtensionSessionBackendContribution } from "../../ExtensionMetadata";
import { Backend, ExtensionContext, SessionBackend, SyntaxThemeProvider, TerminalThemeProvider } from "@extraterm/extraterm-extension-api";


export interface MainInternalExtensionContext extends ExtensionContext {
  readonly _internalBackend: InternalBackend;
}

export interface InternalBackend extends Backend {
  readonly _sessionBackends: LoadedSessionBackendContribution[];
  readonly _syntaxThemeProviders: LoadedSyntaxThemeProviderContribution[];
  readonly _terminalThemeProviders: LoadedTerminalThemeProviderContribution[]
}

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
