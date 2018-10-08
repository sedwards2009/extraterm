/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import * as constants from 'constants';

import {ExtensionContext, Logger, SessionConfiguration} from 'extraterm-extension-api';
import {UnixSessionEditorUi} from './UnixSessionEditorUi';


let log: Logger = null;

interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

let etcShells: string[] = [];

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("UnixSessionEditorExtension activate");
  
  class UnixSessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: UnixSessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new UnixSessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <UnixSessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: UnixSessionConfiguration): void {
      let fixedConfig = config;
      if (config.shell == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: config.name,
          useDefaultShell: true,
          shell: "",
          args: ""
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
      this._ui.shell = fixedConfig.shell;
      this._ui.etcShells = etcShells;
      this._ui.args = fixedConfig.args;
    }

    _dataChanged(): void {
      const changes = {
        name: this._ui.name,
        useDefaultShell: this._ui.useDefaultShell === 1,
        shell: this._ui.shell,
        args: this._ui.args,
      };
      this._checkShellPath();
      this.updateSessionConfiguration(changes);
    }

    _checkShellPath(): void {
      if ( ! this._ui.useDefaultShell && this._ui.shell !== "") {
        const shellPath = this._ui.shell;

        this._checkExecutablePath(shellPath).then(resultMsg => {
          if (shellPath === this._ui.shell) {
            this._ui.shellErrorMsg = resultMsg;
          }
        });
      } else {
        this._ui.shellErrorMsg = "";
      }
    }

    async _checkExecutablePath(exePath: string): Promise<string> {
      try {
        const metadata = await fse.stat(exePath);
        if ( ! metadata.isFile()) {
          return "Path isn't a file";
        }

        await fse.access(exePath, fse.constants.X_OK);
      } catch(err) {
        if (err.errno === -constants.ENOENT) {
          return "Path doesn't exist";
        }
        if (err.errno === -constants.EACCES) {
          return "Path isn't executable";
        }
        return "errno: " +  err.errno + ", err.code: " + err.code;
      } 
      return "";
    }
  }

  context.workspace.registerSessionEditor("unix", UnixSessionEditor);
  
  readEtcShells().then(result => {
    etcShells = result;
  });
}

const ETC_SHELLS = "/etc/shells";

async function readEtcShells(): Promise<string[]> {
  if (await fse.exists(ETC_SHELLS)) {
    const shellText = await fse.readFile("/etc/shells", "utf-8");

    const lines = shellText.split("\n");
    const result: string[] = [];
    for (const line of lines) {
      if ( ! line.startsWith("#") && line.trim() !== "") {
        result.push(line);
      }
    }
    return result;
  } else {
    return [];
  }
}
