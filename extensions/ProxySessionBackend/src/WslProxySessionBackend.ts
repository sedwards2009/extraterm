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
import * as SourceDir from './SourceDir';

interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

export class WslProxySessionBackend implements SessionBackend {
  private _connector: WslProxyPtyConnector = null;

  constructor(private _log: Logger) {
  }
  
  defaultSessionConfigurations(): SessionConfiguration[] {
    if (this._validateExe("wsl.exe")) {
      const wslSessionConfig: WslProxySessionConfiguration = {
        uuid: "",
        name: "WSL",
        type: "wsl",
        useDefaultShell: true,
        shell: ""
      };
      return [wslSessionConfig];
    } else {
      return [];
    }
  }

  private _validateExe(exe: string): boolean {
    const searchPaths: string[] = process.env.PATH.split(";");
    for (const p of searchPaths) {
      const testPath = path.join(p, exe);
      if (this._validateExePath(testPath)) {
        return true;
      }
    }
    return false;
  }

  private _validateExePath(exePath: string): boolean {
    try {
      fs.accessSync(exePath, fs.constants.X_OK);
      return true;
    } catch(err) {
      return false;
    }
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

    const connector = this._getConnector();
    return connector.spawn(options);
  }
  
  private _getConnector(): ProxyPtyConnector {
    if (this._connector == null) {
      this._connector = new WslProxyPtyConnector(this._log);
      this._connector.start();
    }
    return this._connector;
  }
}

let _log: Logger = null;

class WslProxyPtyConnector extends ProxyPtyConnector {
  constructor(logger: Logger) {
    super(logger);
    _log = logger;
  }

  protected _spawnServer(): child_process.ChildProcess {
    let serverPath = path.join(SourceDir.path, "python/ptyserver2.py");
    serverPath = "/mnt/" + serverPath.replace(/\\/g, "/").replace("C:", "c");

    _log.debug(`serverPath: ${serverPath}`);
    return child_process.spawn("wsl.exe", ["PYTHONIOENCODING=utf-8:ignore", "python3", serverPath], {});
  }
}
