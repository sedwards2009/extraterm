/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { app } from 'electron';

import {BulkFileHandle, BulkFileState, CommandEntry, ExtensionContext, Logger, Pty, Terminal, SessionConfiguration, Backend, SessionBackend, EnvironmentMap} from 'extraterm-extension-api';

import { ProxyPtyConnector, PtyOptions } from './ProxyPty';

interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

export class WslProxyBackend implements SessionBackend {
  private _connectors = new Map<string, ProxyPtyConnector>();

  constructor(private _log: Logger) {
  }
  
  defaultSessionConfigurations(): SessionConfiguration[] {
    // const cygwinSessionConfig: ProxySessionConfiguration = {
    //   uuid: "",
    //   name: "Cygwin default shell",
    //   type: "cygwin",
    //   useDefaultShell: true,
    //   shell: "",
    //   cygwinPath: cygwinDir
    // };
    // return [cygwinSessionConfig];
    return [];
  }
  
  createSession(sessionConfiguration: SessionConfiguration, extraEnv: EnvironmentMap, cols: number, rows: number): Pty {
    const sessionConfig = <WslProxySessionConfiguration> sessionConfiguration;

    const defaultShell = "/bin/bash";
    let shell = sessionConfig.useDefaultShell ? defaultShell : sessionConfig.shell;
    const args = ["-l"];
    
    const extraPtyEnv = {
      TERM: "xterm"
    };

    for (let prop in extraEnv) {
      extraPtyEnv[prop] = extraEnv[prop];
    }

    const options: PtyOptions = {
      name: "xterm",
      exe: shell,
      args,
      env: null,
      extraEnv: extraPtyEnv,
      cols: cols,
      rows: rows
    };

    const pythonExe = "WSL";  // FIXME
    const connector = this._getConnector(pythonExe);
    return connector.spawn(options);
  }
  
  private _getConnector(pythonExe: string): ProxyPtyConnector {
    if ( ! this._connectors.has(pythonExe)) {
      this._connectors.set(pythonExe, new ProxyPtyConnector(this._log, pythonExe));
    }
    return this._connectors.get(pythonExe);
  }
}
