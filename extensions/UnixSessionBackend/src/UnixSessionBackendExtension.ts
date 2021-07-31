/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as constants from 'constants';
import * as fs from 'fs';
import * as _ from 'lodash';
import { ExtensionContext, Logger, Pty, SessionConfiguration, SessionBackend, EnvironmentMap, CreateSessionOptions } from '@extraterm/extraterm-extension-api';
import { ShellStringParser } from 'extraterm-shell-string-parser';

import { UnixPty, PtyOptions } from './UnixPty';

interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

interface PasswdLine {
  username: string;
  homeDir: string;
  shell: string;
}

class UnixBackend implements SessionBackend {

  constructor(private _log: Logger) {
  }

  defaultSessionConfigurations(): SessionConfiguration[] {
    const loginSessionConfig: UnixSessionConfiguration = {
      uuid: "",
      name: "Default shell",
      type: "unix",
      useDefaultShell: true,
      shell: "",
      initialDirectory: "",
    };
    return [loginSessionConfig];
  }

  createSession(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const sessionConfig = <UnixSessionConfiguration> sessionConfiguration;

    let shell = sessionConfig.useDefaultShell ? this._readDefaultUserShell(process.env.USER) : sessionConfig.shell;
    let preMessage = "";
    try {
      fs.accessSync(shell, fs.constants.X_OK);
    } catch(err) {
      preMessage = `\x0a\x0d\x0a\x0d*** Shell '${shell}' couldn't be executed, falling back to '/bin/sh' ***\x0a\x0d\x0a\x0d\x0a\x0d`;
      shell = "/bin/sh";
    }

    // OSX expects shells to be login shells. Linux etc doesn't
    const args = (process.platform === "darwin" ? ["-l"] : []).concat(ShellStringParser(sessionConfig.args));

    const ptyEnv = _.cloneDeep(process.env);
    ptyEnv["TERM"] = "xterm-256color";
    if (process.platform === "darwin" && !("LANG" in ptyEnv)) {
      ptyEnv["LANG"] = this._readAppleLocale() + ".UTF-8";
    }

    let prop: string;
    for (prop in sessionOptions.extraEnv) {
      ptyEnv[prop] = sessionOptions.extraEnv[prop];
    }

    let cwd: string = null;

    if (sessionConfig.initialDirectory != null && sessionConfig.initialDirectory !== "") {
      const dirError = this._validateDirectoryPath(sessionConfig.initialDirectory);
      if (dirError != null) {
        preMessage += `\x0a\x0d\x0a\x0d*** Initial directory '${cwd}' couldn't be found. ***\x0a\x0d\x0a\x0d\x0a\x0d`;
      } else {
        cwd = sessionConfig.initialDirectory;
      }
    }

    if (cwd == null && sessionOptions.workingDirectory != null) {
      const dirError = this._validateDirectoryPath(sessionOptions.workingDirectory);
      if (dirError == null) {
        cwd = sessionOptions.workingDirectory;
      }
    }

    if (cwd == null) {
      if (process.platform === "darwin" && process.env.HOME == undefined) {
        cwd = this._readHomeDirectoryFromOpenDirectory(process.env.USER);
      } else {
        cwd = process.env.HOME;
      }
    }

    const dirError = this._validateDirectoryPath(cwd);
    if (dirError != null) {
      preMessage += `\x0a\x0d\x0a\x0d*** Initial directory '${cwd}' couldn't be found. ***\x0a\x0d\x0a\x0d\x0a\x0d`;
    }

    const options: PtyOptions = {
      exe: shell,
      args,
      env: ptyEnv,
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      cwd,
      preMessage
    };

    return new UnixPty(this._log, options);
  }

  private _readDefaultUserShell(userName: string): string {
    if (process.platform === "darwin") {
      return this._readDefaultUserShellFromOpenDirectory(userName);
    } else {
      return this._readDefaultUserShellFromEtcPasswd(userName);
    }
  }

  private _readDefaultUserShellFromEtcPasswd(userName: string): string {
    let shell = "/bin/bash";
    const passwdDb = this._readPasswd("/etc/passwd");
    const userRecords = passwdDb.filter( row => row.username === userName);
    if (userRecords.length !== 0) {
      shell = userRecords[0].shell;
    }
    return shell;
  }

  private _readDefaultUserShellFromOpenDirectory(userName: string): string {
    try {
      const regResult: string = <any> child_process.execFileSync("dscl",
        [".", "-read", "/Users/" + userName, "UserShell"],
        {encoding: "utf8"});
      const parts = regResult.split(/ /g);
      const shell = parts[1].trim();
      this._log.info("Found default user shell with Open Directory: " + shell);
      return shell;
    } catch(e) {
      this._log.warn("Couldn't run Open Directory dscl command to find the user's default shell. Defaulting to /bin/bash");
      return "/bin/bash";
    }
  }

  private _readPasswd(filename: string): PasswdLine[] {
    const fileText = fs.readFileSync(filename, {encoding: 'utf8'});
    const lines = fileText.split(/\n/g);
    return lines.map<PasswdLine>( line => {
      const fields = line.split(/:/g);
      return { username: fields[0], homeDir: fields[5], shell: fields[6] };
    });
  }

  private _readHomeDirectoryFromOpenDirectory(userName: string): string {
    try {
      const regResult: string = <any> child_process.execFileSync("dscl",
        [".", "-read", "/Users/" + userName, "NFSHomeDirectory"],
        {encoding: "utf8"});
      const parts = regResult.split(/ /g);
      const home = parts[1].trim();
      this._log.info("Found home directory with Open Directory: " + home);
      return home;
    } catch(e) {
      this._log.warn("Couldn't run Open Directory dscl command to find the user's home directory.");
      return undefined;
    }
  }

  private _readAppleLocale(): string {
    try {
      const result: string = <any> child_process.execFileSync("defaults",
        ["read", "-g", "AppleLocale"],
        {encoding: "utf8"});
      const locale = result.trim();
      this._log.info("Found user locale: " + locale);
      return locale;
    } catch(e) {
      this._log.warn("Couldn't run defaults command to find the user's locale. Defaulting to en_US");
      return "en_US";
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
  context.backend.registerSessionBackend("Unix", new UnixBackend(context.logger));
}
