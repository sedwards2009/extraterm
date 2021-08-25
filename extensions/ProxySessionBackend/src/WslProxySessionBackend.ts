/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { ShellStringParser } from 'extraterm-shell-string-parser';

import { Logger, Pty, SessionConfiguration, SessionBackend, CreateSessionOptions} from '@extraterm/extraterm-extension-api';

import { ProxyPtyConnector, PtyOptions } from './ProxyPty';
import * as SourceDir from './SourceDir';

interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  distribution?: string;
}

export class WslProxySessionBackend implements SessionBackend {
  private _connectorMap = new Map<string, WslProxyPtyConnector>();
  private _hasWsl = false;
  private _distributions: string[] = [];

  constructor(private _log: Logger) {
    this._hasWsl = this._validateExe("wsl.exe");
    if (this._hasWsl) {
      this._distributions = this._findWSLDistributions();
    }
  }

  defaultSessionConfigurations(): SessionConfiguration[] {
    const configs: WslProxySessionConfiguration[] = [];
    if (this._hasWsl) {
      const wslSessionConfig: WslProxySessionConfiguration = {
        uuid: "",
        name: "WSL Default",
        type: "wsl",
        useDefaultShell: true,
        shell: "",
        args: "",
        distribution: "",
      };
      configs.push(wslSessionConfig);

      for (const distro of this._distributions) {
        const wslSessionConfig: WslProxySessionConfiguration = {
          uuid: "",
          name: "WSL " + distro,
          type: "wsl",
          useDefaultShell: true,
          shell: "",
          args: "",
          distribution: distro,
        };
        configs.push(wslSessionConfig);
      }
    }

    return configs;
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

  private _findWSLDistributions(): string[] {
    const wslResult = child_process.spawnSync("wsl.exe", ["--list"], {encoding: "utf16le"});
    if (wslResult.status !== 0) {
      return [];
    }

    const result: string[] = [];
    const lines = wslResult.stdout.trim().split("\n");
    for (const line of lines.slice(1)) {
      if (line.trim() === "") {
        continue;
      }
      const parts = line.split(" ");
      result.push(parts[0].trim());
    }
    return result;
  }

  createSession(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const sessionConfig = <WslProxySessionConfiguration> sessionConfiguration;

    const defaultShell = "/bin/bash";
    const shell = sessionConfig.useDefaultShell ? defaultShell : sessionConfig.shell;
    const args = ["-l"].concat(ShellStringParser(sessionConfig.args));

    const extraPtyEnv = {
      TERM: "xterm-256color"
    };

    for (const prop in sessionOptions.extraEnv) {
      extraPtyEnv[prop] = sessionOptions.extraEnv[prop];
    }

    const options: PtyOptions = {
      exe: shell,
      args,
      env: null,
      extraEnv: extraPtyEnv,
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      suggestedCwd: sessionOptions.workingDirectory || null
    };

    if (sessionConfig.initialDirectory != null && sessionConfig.initialDirectory !== "") {
      options.cwd = sessionConfig.initialDirectory;
    }

    const connector = this._getConnector(sessionConfig.distribution);
    return connector.spawn(options);
  }

  private _getConnector(distribution: string): ProxyPtyConnector {
    const distro = distribution == null || distribution === "" ? "" : distribution;
    let connector = this._connectorMap.get(distro);
    if (connector == null) {
      connector = new WslProxyPtyConnector(this._log, distro);
      connector.onProxyClosed(() => {
        this._connectorMap.delete(distro);
      });
      this._connectorMap.set(distro, connector);
      connector.start();
    }
    return connector;
  }
}

let _log: Logger = null;

class WslProxyPtyConnector extends ProxyPtyConnector {
  constructor(logger: Logger, private _distribution: string) {
    super(logger);
    _log = logger;
  }

  protected _spawnServer(): child_process.ChildProcess {
    const distro = this._distribution == null || this._distribution === "" ? "" : this._distribution;
    const distroArgs = distro === "" ? [] : ["-d", distro];

    // Clever way of mapping a Windows side dir to its WSL/Linux side equivalent.
    const proxyDirPath = SourceDir.path;
    const cdResult = child_process.spawnSync("wsl.exe", [...distroArgs, "pwd"],
      {cwd: proxyDirPath, shell: true, encoding: "utf8"});

    if (cdResult.status !== 0) {
      _log.warn("'wsl.exe pwd' returned status code ${cdResult.status} and stdout '${cdResult.stdout}'.");
      // FIXME throw new Exception();
    }

    const wslPath = cdResult.stdout.trim();
    if (wslPath.split("\n").length !== 1) {
      _log.warn("'wsl.exe pwd' gave unexpected output. stdout '${cdResult.stdout}'.");
      // FIXME throw new Exception();
    }

    const serverPath = wslPath + "/extraterm-wsl-proxy";
    _log.debug(`serverPath: ${serverPath}`);
    return child_process.spawn("wsl.exe", [...distroArgs, serverPath], {});
  }
}
