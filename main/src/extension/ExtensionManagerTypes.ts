/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash-es";
import { ExtensionBlock, SessionBackend, TerminalThemeProvider } from "@extraterm/extraterm-extension-api";

import { ExtensionMetadata, ExtensionSessionBackendContribution, ExtensionSettingsTabContribution } from "./ExtensionMetadata.js";


export interface LoadedSessionBackendContribution {
  metadata: ExtensionMetadata;
  sessionBackendMetadata: ExtensionSessionBackendContribution;
  sessionBackend: SessionBackend;
}

export interface LoadedTerminalThemeProviderContribution {
  metadata: ExtensionMetadata;
  terminalThemeProvider: TerminalThemeProvider;
}
