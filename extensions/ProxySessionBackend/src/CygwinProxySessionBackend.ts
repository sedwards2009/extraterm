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
import { parseArgs } from 'extraterm-args';

import * as SourceDir from './SourceDir';
import { ProxyPtyConnector, PtyOptions } from './ProxyPty';

interface CygwinProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  cygwinPath?: string;
}

interface PasswdLine {
  username: string;
  homeDir: string;
  shell: string;
}

export class CygwinProxySessionBackend implements SessionBackend {
  
  private _connectors = new Map<string, ProxyPtyConnector>();

  constructor(private _log: Logger) {
  }
  
  defaultSessionConfigurations(): SessionConfiguration[] {
    // Find a default cygwin installation.
    let cygwinDir = this._findCygwinInstallation();
    if (cygwinDir === null) {
      cygwinDir = this._findBabunCygwinInstallation();
    }
    if (cygwinDir === null) {
      return [];
    }

    const cygwinSessionConfig: CygwinProxySessionConfiguration = {
      uuid: "",
      name: "Cygwin default shell",
      type: "cygwin",
      useDefaultShell: true,
      shell: "",
      cygwinPath: cygwinDir
    };
    return [cygwinSessionConfig];
  }

  private _findCygwinInstallation(): string {
    try {
      const regResult: string = <any> child_process.execFileSync("REG",
        ["query","HKLM\\SOFTWARE\\Cygwin\\setup","/v","rootdir"],
        {encoding: "utf8"});
      const parts = regResult.split(/\r/g);
      const regsz = parts[2].indexOf("REG_SZ");
      const cygwinDir = parts[2].slice(regsz+6).trim();
      
      if (fs.existsSync(cygwinDir)) {
        this._log.info("Found cygwin installation at " + cygwinDir);
        return cygwinDir;
      } else {
        this._log.info("The registry reported the cygwin installation directory at '" + cygwinDir +
          "', but the directory does not exist.");
        return null;
      }
    } catch(e) {
      this._log.info("Couldn't find a cygwin installation.");
      return null;
    }
  }
  
  private _findBabunCygwinInstallation(): string {
    const cygwinDir = path.join(app.getPath('home'), ".babun/cygwin");
    if (fs.existsSync(cygwinDir)) {
      this._log.info("Found babun cygwin installation at " + cygwinDir);
      return cygwinDir;
    } else {
      this._log.info("Couldn't find a Babun cygwin installation.");
      return null;
    }
  }
  
  createSession(sessionConfiguration: SessionConfiguration, extraEnv: EnvironmentMap, cols: number, rows: number): Pty {
    const sessionConfig = <CygwinProxySessionConfiguration> sessionConfiguration;
    const {homeDir, defaultShell} = this._getDefaultCygwinConfig(sessionConfig.cygwinPath);
    const shell = sessionConfig.useDefaultShell ? defaultShell : sessionConfig.shell;

    const args = ["-l"].concat(parseArgs(sessionConfig.args));
    
    const ptyEnv = _.cloneDeep(process.env);
    ptyEnv["TERM"] = "xterm-256color";
    ptyEnv["HOME"] = homeDir;

    let prop: string;
    for (prop in extraEnv) {
      ptyEnv[prop] = extraEnv[prop];
    }

    const options: PtyOptions = {
      exe: shell,
      args,
      env: ptyEnv,
      cols: cols,
      rows: rows
    };

    const pythonExe = this._findCygwinPython(sessionConfig.cygwinPath);
    if (pythonExe == null) {
      throw new Error(
        `Unable to find a suitable python executable in cygwin installation '${sessionConfig.cygwinPath}'`);
    }
    const connector = this._getConnector(pythonExe);
      
    return connector.spawn(options);
  }

  private _findCygwinPython(cygwinDir: string): string {
    const binDir = path.join(cygwinDir, 'bin');
    this._log.info("Cygwin bin directory is ", binDir);
    if (fs.existsSync(binDir)) {
      const pythonRegexp = /^python3.*m\.exe$/;
      const binContents = fs.readdirSync(binDir);
      const pythons = binContents.filter( name => pythonRegexp.test(name) );
      return pythons.length !== 0 ? path.join(binDir,pythons[0]) : null;
    }
    return null;
  }
  
  private _getDefaultCygwinConfig(cygwinDir: string): {defaultShell: string, homeDir: string} {
    let defaultShell: string = null;
    let homeDir: string = null;
    
    const passwdPath = path.join(cygwinDir, "etc", "passwd");
    if (fs.existsSync(passwdPath)) {
      // Get the info from /etc/passwd
      const passwdDb = this._readPasswd(passwdPath);
      const username = process.env["USERNAME"];
      const userRecords = passwdDb.filter( row => row.username === username);
      if (userRecords.length !== 0) {
        defaultShell = userRecords[0].shell;
        homeDir = userRecords[0].homeDir;
      }
    }
    
    if (homeDir === null) {
      // Couldn't get the info we needed from /etc/passwd. Cygwin doesn't make a /etc/passwd by default anymore.
      defaultShell = "/bin/bash";
      homeDir = "/home/" + process.env["USERNAME"];
    }
    
    return {defaultShell, homeDir};
  }

  private _readPasswd(filename: string): PasswdLine[] {
    const fileText = fs.readFileSync(filename, {encoding: 'utf8'});
    const lines = fileText.split(/\n/g);
    return lines.map<PasswdLine>( line => {
      const fields = line.split(/:/g);
      return { username: fields[0], homeDir: fields[5], shell: fields[6] };
    });
  }

  private _getConnector(pythonExe: string): ProxyPtyConnector {
    if ( ! this._connectors.has(pythonExe)) {
      const connector = new CygwinProxyPtyConnector(this._log, pythonExe);
      connector.start();
      this._connectors.set(pythonExe, connector);
    }
    return this._connectors.get(pythonExe);
  }
}

let _log: Logger = null;
class CygwinProxyPtyConnector extends ProxyPtyConnector {
  constructor(logger: Logger, private _pythonExe: string) {
    super(logger);
    _log = logger;
  }

  protected _spawnServer(): child_process.ChildProcess {
    let serverEnv = _.clone(process.env);
    serverEnv["PYTHONIOENCODING"] = "utf-8:ignore";
_log.debug(`this._pythonExe: ${this._pythonExe}`);
    return child_process.spawn(this._pythonExe, [path.join(SourceDir.path, "python/ptyserver2.py")], {env: serverEnv});
  }
}