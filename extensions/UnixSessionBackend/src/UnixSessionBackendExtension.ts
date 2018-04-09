/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {BulkFileHandle, BulkFileState, CommandEntry, ExtensionContext, Logger, Terminal, SessionConfiguration, Backend, SessionBackend} from 'extraterm-extension-api';


interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
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
      shell: ""
    };
    return [loginSessionConfig];
  }
}

export function activate(context: ExtensionContext): any {
  context.backend.registerSessionBackend("unix", new UnixBackend(context.logger));
}
