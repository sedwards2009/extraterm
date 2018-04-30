/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');
import * as fse from 'fs-extra';
import * as constants from 'constants';
import * as path from 'path';

import {ExtensionContext, Logger, SessionConfiguration} from 'extraterm-extension-api';
import {ProxySessionEditorUi} from './ProxySessionEditorUi';


let log: Logger = null;

interface ProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  cygwinPath?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("ProxySessionEditorExtension activate");
  
  class ProxySessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: ProxySessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new ProxySessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <ProxySessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: ProxySessionConfiguration): void {
      let fixedConfig = config;
      if (config.shell == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: "Cygwin",
          useDefaultShell: true,
          shell: "",
          cygwinPath: ""          
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
      this._ui.shell = fixedConfig.shell;
      this._ui.cygwinPath = fixedConfig.cygwinPath;
    }

    _dataChanged(): void {
      const changes = {
        name: this._ui.name,
        useDefaultShell: this._ui.useDefaultShell === 1,
        shell: this._ui.shell,
        cygwinPath: this._ui.cygwinPath
      };
      this._checkPaths();
      this.updateSessionConfiguration(changes);
    }

    _checkPaths(): void {
      const cygwinPath = this._ui.cygwinPath;
      this._checkDirectoryPath(cygwinPath).then(resultMsg => {
        if (cygwinPath === this._ui.cygwinPath) {
          this._ui.cygwinPathErrorMsg = resultMsg;
        }
      });

      if ( ! this._ui.useDefaultShell && this._ui.shell !== "") {
        const shell = this._ui.shell;
        this._checkShellPath(cygwinPath, shell).then(resultMsg => {
          if (shell === this._ui.shell && cygwinPath === this._ui.cygwinPath) {
            this._ui.shellErrorMsg = resultMsg;
          }
        });
      } else {
        this._ui.shellErrorMsg = "";
      }
    }

    async _checkDirectoryPath(dirPath: string): Promise<string> {
      try {
        const metadata = await fse.stat(dirPath);
        if ( ! metadata.isDirectory()) {
          return "Path isn't a directory";
        }

        await fse.access(dirPath, fse.constants.R_OK);
      } catch(err) {
        if (err.code === "ENOENT") {
          return "Path doesn't exist";
        }
        if (err.code === "EACCES") {
          return "Path isn't accessible";
        }
        return "errno: " +  err.errno + ", err.code: " + err.code;
      }
      return "";
    }

    async _checkShellPath(cygwinPath: string, shell: string): Promise<string> {

      const windowsFullPath = path.join(cygwinPath, shell.replace("/", "\\")) + ".exe";

      const errorMsg = await this._checkSingleShellPath(windowsFullPath);
      if (errorMsg === "") {
        return "";
      }

      // Check alternate shell path.
      // Cygwin treats /usr/bin and /bin as being the same thing.
      let altShell = "";
      if (shell.startsWith("/usr/bin/")) {
        altShell = shell.substr(4); // /bin version.
      } else if(shell.startsWith("/bin/")) {
        altShell = "/usr" + shell;
      } else {
        return errorMsg;
      }

      const altWindowsFullPath = path.join(cygwinPath, altShell.replace("/", "\\")) + ".exe";

      return this._checkSingleShellPath(altWindowsFullPath);
    }

    async _checkSingleShellPath(shellPath: string): Promise<string> {
      try {
        const metadata = await fse.stat(shellPath);
        if ( ! metadata.isFile()) {
          return "Path isn't a file";
        }
        await fse.access(shellPath, fse.constants.X_OK);
      } catch(err) {
        if (err.code === "ENOENT") {
          return "Path doesn't exist";
        }
        if (err.code === "EACCES") {
          return "Path isn't executable";
        }
        return "errno: " +  err.errno + ", err.code: " + err.code;
      }
      return "";
    }
  }

  context.workspace.registerSessionEditor("cygwin", ProxySessionEditor);
}
