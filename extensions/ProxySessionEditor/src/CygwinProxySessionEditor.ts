/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');
import * as child_process from 'child_process';
import * as fse from 'fs-extra';
import * as constants from 'constants';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';

import {ExtensionContext, Logger, SessionConfiguration} from 'extraterm-extension-api';
import {CygwinProxySessionEditorUi} from './CygwinProxySessionEditorUi';


let log: Logger = null;

interface CygwinProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  cygwinPath?: string;
}

export function getCygwinProxySessionEditorClass(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("ProxySessionEditorExtension activate");
  let cygwinInstallationDir = "";

  class ProxySessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: CygwinProxySessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new CygwinProxySessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <CygwinProxySessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: CygwinProxySessionConfiguration): void {
      let fixedConfig = config;
      if (config.shell == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: "Cygwin",
          useDefaultShell: true,
          shell: "",
          cygwinPath: cygwinInstallationDir
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
      this._checkCygwinPath(cygwinPath).then(resultMsg => {
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

    async _checkCygwinPath(dirPath: string): Promise<string> {
      try {
        const metadata = await fse.stat(dirPath);
        if ( ! metadata.isDirectory()) {
          return "Path isn't a directory";
        }

        await fse.access(dirPath, fse.constants.R_OK);

        const binDir = path.join(dirPath, 'bin');
        if (await fse.exists(binDir)) {
          const pythonRegexp = /^python3.*m\.exe$/;
          const binContents = await fse.readdir(binDir);
          const pythons = binContents.filter( name => pythonRegexp.test(name) );
          if (pythons.length === 0) {
            return "Couldn't find a suitable Python executable under this path";
          }
        } else {
          return "Couldn't find a suitable Python executable under this path";
        }
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

  cygwinInstallationDir = findCygwinInstallation();
  if (cygwinInstallationDir == null) {
    cygwinInstallationDir = findBabunCygwinInstallation();
  }
  cygwinInstallationDir = cygwinInstallationDir == null ? "" : cygwinInstallationDir;

  return ProxySessionEditor;
}

function findCygwinInstallation(): string {
  try {
    const regResult: string = <any> child_process.execFileSync("REG",
      ["query","HKLM\\SOFTWARE\\Cygwin\\setup","/v","rootdir"],
      {encoding: "utf8"});
    const parts = regResult.split(/\r/g);
    const regsz = parts[2].indexOf("REG_SZ");
    const cygwinDir = parts[2].slice(regsz+6).trim();
    
    if (fse.existsSync(cygwinDir)) {
      log.info("Found cygwin installation at " + cygwinDir);
      return cygwinDir;
    } else {
      log.info("The registry reported the cygwin installation directory at '" + cygwinDir +
        "', but the directory does not exist.");
      return null;
    }
  } catch(e) {
    log.info("Couldn't find a cygwin installation.");
    return null;
  }
}

function findBabunCygwinInstallation(): string {
  const cygwinDir = path.join(os.homedir(), ".babun/cygwin");
  if (fse.existsSync(cygwinDir)) {
    log.info("Found babun cygwin installation at " + cygwinDir);
    return cygwinDir;
  } else {
    log.info("Couldn't find a Babun cygwin installation.");
    return null;
  }
}
