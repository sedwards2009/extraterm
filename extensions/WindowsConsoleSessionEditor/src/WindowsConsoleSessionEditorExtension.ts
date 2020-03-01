/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import * as constants from 'constants';

import {ExtensionContext, Logger, SessionConfiguration} from '@extraterm/extraterm-extension-api';
import {WindowsConsoleSessionEditorUi} from './WindowsConsoleSessionEditorUi';


let log: Logger = null;

interface WindowsConsoleSessionConfiguration extends SessionConfiguration {
  exe?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  class WindowsConsoleSessionEditor extends context.window.extensionSessionEditorBaseConstructor {
    private _ui: WindowsConsoleSessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new WindowsConsoleSessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <WindowsConsoleSessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);

      this._initializeAvailableExes();
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    private _loadConfig(config: WindowsConsoleSessionConfiguration): void {
      let fixedConfig = config;
      if (config.exe == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: config.name,
          exe: "cmd.exe",
          args: "",
          initialDirectory: "",
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.exe = fixedConfig.exe;
      this._ui.args = fixedConfig.args;
      this._ui.initialDirectory = fixedConfig.initialDirectory || "";
    }

    private _dataChanged(): void {
      const changes: Partial<WindowsConsoleSessionConfiguration> = {
        name: this._ui.name,
        exe: this._ui.exe,
        args: this._ui.args,
        initialDirectory: this._ui.initialDirectory,
      };
      this._checkExeField();
      this._checkInitialDirectory();
      this.updateSessionConfiguration(changes);
    }

    private _checkExeField(): void {
      if (this._ui.exe !== "") {
        const exePath = this._ui.exe;

        this._checkExe(exePath).then(resultMsg => {
          if (exePath === this._ui.exe) {
            this._ui.exeErrorMsg = resultMsg;
          }
        });
      } else {
        this._ui.exeErrorMsg = "";
      }
    }

    private async _checkExe(exe: string): Promise<string> {
      if (path.isAbsolute(exe)) {
        return this._checkExecutablePath(exe);
      }

      const searchPaths: string[] = process.env.PATH.split(";");
      for (const p of searchPaths) {
        const testPath = path.join(p, exe);
        const result = await this._checkExecutablePath(testPath);
        if (result === "") {
          return "";
        }
      }
      return "Couldn't find executable";
    }

    private async _checkExecutablePath(exePath: string): Promise<string> {
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

    private async _initializeAvailableExes(): Promise<void> {
      const availableExes: string[] = [];
      for (const exePath of ["cmd.exe", "powershell.exe", "pwsh.exe"]) {
        const errorMsg = await this._checkExe(exePath);
        if (errorMsg === "") {
          availableExes.push(exePath);
        }
      }
      this._ui.availableExes = availableExes;
    }

    private _checkInitialDirectory(): void {
      if ( this._ui.initialDirectory !== "") {
        const initialDirectory = this._ui.initialDirectory;
  
        this._checkDirectoryPath(initialDirectory).then(resultMsg => {
          if (initialDirectory === this._ui.initialDirectory) {
            this._ui.initialDirectoryErrorMsg = resultMsg;
          }
        });
      } else {
        this._ui.initialDirectoryErrorMsg = "";
      }
    }  

    private async _checkDirectoryPath(exePath: string): Promise<string> {
      try {
        const metadata = await fse.stat(exePath);
        if ( ! metadata.isDirectory()) {
          return "Path isn't a directory";
        }

        await fse.access(exePath, fse.constants.R_OK);
      } catch(err) {
        if (err.errno === -constants.ENOENT || err.code === "ENOENT") {
          return "Path doesn't exist";
        }
        if (err.errno === -constants.EACCES) {
          return "Path isn't readable";
        }
        return `errno: ${err.errno}, err.code: ${err.code}`;
      } 
      return "";
    }
  }

  context.window.registerSessionEditor("windows-console", WindowsConsoleSessionEditor);
}
