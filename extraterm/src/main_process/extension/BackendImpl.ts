/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata } from "../../ExtensionMetadata";
import { Backend, SessionBackend, SyntaxThemeProvider, TerminalThemeProvider } from "@extraterm/extraterm-extension-api";
import { log } from "extraterm-logging";
import { LoadedSessionBackendContribution, LoadedSyntaxThemeProviderContribution,
  LoadedTerminalThemeProviderContribution } from "./ExtensionManagerTypes";


export class BackendImpl implements Backend {
  private _log: Logger = null;
  __BackendImpl__sessionBackends: LoadedSessionBackendContribution[] = [];
  __BackendImpl__syntaxThemeProviders: LoadedSyntaxThemeProviderContribution[] = [];
  __BackendImpl__terminalThemeProviders: LoadedTerminalThemeProviderContribution[] = [];

  constructor(public __extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("Backend (" + this.__extensionMetadata.name + ")", this);
  }

  registerSessionBackend(name: string, backend: SessionBackend): void {
    for (const backendMeta of this.__extensionMetadata.contributes.sessionBackends) {
      if (backendMeta.name === name) {
        this.__BackendImpl__sessionBackends.push({
          metadata: this.__extensionMetadata,
          sessionBackendMetadata: backendMeta,
          sessionBackend: backend
        });
        return;
      }
    }

    this._log.warn(`Unable to register session backend '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the session backend contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerSyntaxThemeProvider(name: string, provider: SyntaxThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.syntaxThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__syntaxThemeProviders.push({
          metadata: this.__extensionMetadata,
          syntaxThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register syntax theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the syntax theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerTerminalThemeProvider(name: string, provider: TerminalThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.terminalThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__terminalThemeProviders.push({
          metadata: this.__extensionMetadata,
          terminalThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register terminal theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the terminal theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }
}
