/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { ExtensionContext, Logger, Pty, SessionConfiguration, SessionBackend, EnvironmentMap } from 'extraterm-extension-api';
import { shell_string_parser } from 'extraterm-shell-string-parser';

import { WindowsConsolePty, PtyOptions } from './WindowsConsolePty';

interface WindowsConsoleSessionConfiguration extends SessionConfiguration {
  exe?: string;
}

const WINDOWS_CONSOLE_TYPE = "windows-console";

class WindowsConsoleBackend implements SessionBackend {

  constructor(private _log: Logger) {
  }
  
  defaultSessionConfigurations(): SessionConfiguration[] {
    const defaultSessions: WindowsConsoleSessionConfiguration[] = [];

    const cmdSessionConfig: WindowsConsoleSessionConfiguration = {
      uuid: "",
      name: "CMD",
      type: WINDOWS_CONSOLE_TYPE,
      exe: "cmd.exe",
      args: ""
    };
    defaultSessions.push(cmdSessionConfig);

    if (this._validateExe("powershell.exe")) {
      const powershellSessionConfig: WindowsConsoleSessionConfiguration = {
        uuid: "",
        name: "PowerShell",
        type: WINDOWS_CONSOLE_TYPE,
        exe: "powershell.exe",
        args: ""
      };
      defaultSessions.push(powershellSessionConfig);
    }

    if (this._validateExe("pwsh.exe")) {
      const powershellCoreSessionConfig: WindowsConsoleSessionConfiguration = {
        uuid: "",
        name: "PowerShell Core",
        type: WINDOWS_CONSOLE_TYPE,
        exe: "pwsh.exe",
        args: ""
      };
      defaultSessions.push(powershellCoreSessionConfig);
    }

    return defaultSessions;
  }

  createSession(sessionConfiguration: SessionConfiguration, extraEnv: EnvironmentMap, cols: number, rows: number): Pty {
    const sessionConfig = <WindowsConsoleSessionConfiguration> sessionConfiguration;
    
    let exe = sessionConfig.exe;
    let preMessage = "";
    const args = shell_string_parser(sessionConfig.args);

    if ( ! this._validateExe(exe)) {
      preMessage = `\x0a\x0d\x0a\x0d*** Program '${exe}' couldn't be executed, falling back to 'cmd.exe' ***\x0a\x0d\x0a\x0d\x0a\x0d`;
      exe = "cmd.exe";
    }

    const ptyEnv = _.cloneDeep(process.env);
    let prop: string;
    for (prop in extraEnv) {
      ptyEnv[prop] = extraEnv[prop];
    }

    const options: PtyOptions = {
      exe: exe,
      args: args,
      env: ptyEnv,
      cols: 80, //cols,
      rows: 24, //rows,
      cwd: process.env.HOME,
      preMessage
    };
    return new WindowsConsolePty(this._log, options);
  }
  
  private _validateExe(exe: string): boolean {
    if (path.isAbsolute(exe)) {
      return this._validateExePath(exe);
    }

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
}

export function activate(context: ExtensionContext): any {
  context.backend.registerSessionBackend("Windows Console", new WindowsConsoleBackend(context.logger));
}
