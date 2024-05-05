/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as constants from "node:constants";
import * as fs from "node:fs";
import * as path from "node:path";
import * as _ from "lodash-es";
import { ExtensionContext, Logger, Pty, SessionConfiguration, SessionBackend, CreateSessionOptions } from "@extraterm/extraterm-extension-api";
import { ShellStringParser } from "extraterm-shell-string-parser";

import { WindowsConsolePty, PtyOptions } from "./WindowsConsolePty.js";

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

  createSession(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const sessionConfig = <WindowsConsoleSessionConfiguration> sessionConfiguration;

    let exe = sessionConfig.exe;
    let preMessage = "";
    const args = ShellStringParser(sessionConfig.args);

    if ( ! this._validateExe(exe)) {
      preMessage = `\x0a\x0d\x0a\x0d*** Program '${exe}' couldn't be executed, falling back to 'cmd.exe'. ***\x0a\x0d\x0a\x0d\x0a\x0d`;
      this._log.warn(`Program '${exe}' couldn't be executed, falling back to 'cmd.exe'.`);
      exe = "cmd.exe";
    }

    const ptyEnv = _.cloneDeep(process.env);
    let prop: string;
    for (prop in sessionOptions.extraEnv) {
      ptyEnv[prop] = sessionOptions.extraEnv[prop];
    }

    let cwd: string = null;

    if (sessionConfig.initialDirectory != null && sessionConfig.initialDirectory !== "") {
      const dirError = this._validateDirectoryPath(sessionConfig.initialDirectory);
      if (dirError != null) {
        preMessage += `\x0a\x0d\x0a\x0d*** Initial directory '${sessionConfig.initialDirectory}' couldn't be found. ***\x0a\x0d\x0a\x0d\x0a\x0d`;
        this._log.warn(`Initial directory '${sessionConfig.initialDirectory}' couldn't be found.`);
      } else {
        cwd = sessionConfig.initialDirectory;
      }
    }

    if (cwd == null && sessionOptions.workingDirectory != null && sessionOptions.workingDirectory !== "") {
      const dirError = this._validateDirectoryPath(sessionOptions.workingDirectory);
      if (dirError == null) {
        cwd = sessionOptions.workingDirectory;
      }
    }

    if (cwd == null) {
      cwd = process.env.HOMEPATH;
    }

    const dirError = this._validateDirectoryPath(cwd);
    if (dirError != null) {
      preMessage += `\x0a\x0d\x0a\x0d*** Initial directory '${cwd}' couldn't be found. ***\x0a\x0d\x0a\x0d\x0a\x0d`;
      this._log.warn(`Initial directory '${cwd}' couldn't be found.`);
    }

    const options: PtyOptions = {
      exe: exe,
      args: args,
      env: ptyEnv,
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      cwd,
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

  private _validateDirectoryPath(dirPath: string): string {
    try {
      const metadata = fs.statSync(dirPath);
      if ( ! metadata.isDirectory()) {
        return "Path isn't a directory";
      }

      fs.accessSync(dirPath, fs.constants.R_OK);
    } catch(err) {
      if (err.errno === -constants.ENOENT) {
        return "Path doesn't exist";
      }
      if (err.errno === -constants.EACCES) {
        return "Path isn't readable";
      }
      return "errno: " +  err.errno + ", err.code: " + err.code;
    }
    return null;
  }
}

export function activate(context: ExtensionContext): any {
  context.sessions.registerSessionBackend("windows-console", new WindowsConsoleBackend(context.logger));
}
