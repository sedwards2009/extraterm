/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');
import * as child_process from 'child_process';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { Logger, SessionConfiguration, SessionEditorBase } from '@extraterm/extraterm-extension-api';
import {CygwinProxySessionEditorUi} from './CygwinProxySessionEditorUi';


interface CygwinProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  cygwinPath?: string;
}

let cygwinInstallationDir = "";

export function init(log: Logger): void {
  cygwinInstallationDir = findCygwinInstallation(log);
  if (cygwinInstallationDir == null) {
    cygwinInstallationDir = findBabunCygwinInstallation(log);
  }
  cygwinInstallationDir = cygwinInstallationDir == null ? "" : cygwinInstallationDir;
}

export function cygwinProxySessionEditorFactory(log: Logger, sessionEditorBase: SessionEditorBase): any {
  const ui = new CygwinProxySessionEditorUi();
  const debouncedDataChanged = _.debounce(dataChanged.bind(null, sessionEditorBase, ui), 500);

  const component = ui.$mount();
  ui.$watch('$data', debouncedDataChanged, { deep: true, immediate: false } );

  const config = <CygwinProxySessionConfiguration> sessionEditorBase.getSessionConfiguration();
  loadConfig(ui, config);

  sessionEditorBase.getContainerElement().appendChild(component.$el);
}

function loadConfig(ui: CygwinProxySessionEditorUi, config: CygwinProxySessionConfiguration): void {
  let fixedConfig = config;
  if (config.shell == null) {
    fixedConfig = {
      uuid: config.uuid,
      name: "Cygwin",
      useDefaultShell: true,
      shell: "",
      cygwinPath: cygwinInstallationDir,
      args: "",
      initialDirectory: "",
    };
  }

  ui.name = fixedConfig.name;
  ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
  ui.shell = fixedConfig.shell;
  ui.cygwinPath = fixedConfig.cygwinPath;
  ui.args = fixedConfig.args;
  ui.initialDirectory = fixedConfig.initialDirectory || "";
}

function dataChanged(sessionEditorBase: SessionEditorBase, ui: CygwinProxySessionEditorUi): void {
  const config = <CygwinProxySessionConfiguration> sessionEditorBase.getSessionConfiguration();

  config.name = ui.name;
  config.useDefaultShell = ui.useDefaultShell === 1;
  config.shell = ui.shell;
  config.cygwinPath = ui.cygwinPath;
  config.args = ui.args;
  config.initialDirectory = ui.initialDirectory;

  checkPaths(ui);

  sessionEditorBase.setSessionConfiguration(config);
}

function checkPaths(ui: CygwinProxySessionEditorUi): void {
  const cygwinPath = ui.cygwinPath;
  checkCygwinPath(cygwinPath).then(resultMsg => {
    if (cygwinPath === ui.cygwinPath) {
      ui.cygwinPathErrorMsg = resultMsg;
    }
  });

  if ( ! ui.useDefaultShell && ui.shell !== "") {
    const shell = ui.shell;
    checkShellPath(cygwinPath, shell).then(resultMsg => {
      if (shell === ui.shell && cygwinPath === ui.cygwinPath) {
        ui.shellErrorMsg = resultMsg;
      }
    });
  } else {
    ui.shellErrorMsg = "";
  }
}

async function checkCygwinPath(dirPath: string): Promise<string> {
  try {
    const metadata = await fse.stat(dirPath);
    if ( ! metadata.isDirectory()) {
      return "Path isn't a directory";
    }

    await fse.access(dirPath, fse.constants.R_OK);

    const binDir = path.join(dirPath, 'bin');
    if (await fse.pathExists(binDir)) {
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

async function checkShellPath(cygwinPath: string, shell: string): Promise<string> {
  const windowsFullPath = path.join(cygwinPath, shell.replace("/", "\\")) + ".exe";

  const errorMsg = await checkSingleShellPath(windowsFullPath);
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

  return checkSingleShellPath(altWindowsFullPath);
}

async function checkSingleShellPath(shellPath: string): Promise<string> {
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

function findCygwinInstallation(log: Logger): string {
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

function findBabunCygwinInstallation(log: Logger): string {
  const cygwinDir = path.join(os.homedir(), ".babun/cygwin");
  if (fse.existsSync(cygwinDir)) {
    log.info("Found babun cygwin installation at " + cygwinDir);
    return cygwinDir;
  } else {
    log.info("Couldn't find a Babun cygwin installation.");
    return null;
  }
}
