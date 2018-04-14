/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as _ from 'lodash';
import {BulkFileHandle, BulkFileState, CommandEntry, ExtensionContext, Logger, Pty, Terminal, SessionConfiguration, Backend, SessionBackend} from 'extraterm-extension-api';

import { UnixPty, PtyOptions } from './ProxyPty';

interface ProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  pythonExe?: string;
}


class ProxyBackend implements SessionBackend {

  constructor(private _log: Logger) {
  }
  
  defaultSessionConfigurations(): SessionConfiguration[] {
    const cygwinSessionConfig: ProxySessionConfiguration = {
      uuid: "",
      name: "Cygwin default shell",
      type: "cygwin",
      useDefaultShell: true,
      shell: "",
      pythonExe: "/usr/bin/python3"
    };
    return [cygwinSessionConfig];
  }

  createSession(sessionConfiguration: SessionConfiguration, cols: number, rows: number): Pty {
    const sessionConfig = <ProxySessionConfiguration> sessionConfiguration;
    
    const shell = sessionConfig.useDefaultShell ? "/bin/bash" : sessionConfig.shell;

    // OSX expects shells to be login shells. Linux etc doesn't
    const args = process.platform === "darwin" ? ["-l"] : [];
    const ptyEnv = _.cloneDeep(process.env);
    ptyEnv["TERM"] = "xterm";

    const options: PtyOptions = {
      name: "xterm",
      exe: shell,
      args,
      env: ptyEnv,
      cols: cols,
      rows: rows
    };
    return new UnixPty(this._log, options);
  }

}

export function activate(context: ExtensionContext): any {
  context.backend.registerSessionBackend("Cygwin", new ProxyBackend(context.logger));
}
