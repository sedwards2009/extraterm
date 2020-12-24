/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import * as fse from "fs-extra";
import * as constants from "constants";

import {ExtensionContext, Logger, SessionConfiguration, SessionEditorBase} from "@extraterm/extraterm-extension-api";
import {UnixSessionEditorUi} from "./UnixSessionEditorUi";


let log: Logger = null;

interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

let etcShells: string[] = [];

export function activate(context: ExtensionContext): any {
  log = context.logger;

  log.info("UnixSessionEditorExtension activate");

  context.window.registerSessionEditor("unix", SessionEditorFactory);

  readEtcShells().then(result => {
    etcShells = result;
  });
}

function SessionEditorFactory(sessionEditorBase: SessionEditorBase): void {
  const ui: UnixSessionEditorUi = new UnixSessionEditorUi();
  const debouncedDataChanged = _.debounce(_dataChanged.bind(null, sessionEditorBase, ui), 500);

  const component = ui.$mount();
  ui.$watch("$data", debouncedDataChanged, { deep: true, immediate: false } );

  const config = <UnixSessionConfiguration> sessionEditorBase.sessionConfiguration;
  loadConfig(ui, config);

  sessionEditorBase.containerElement.appendChild(component.$el);
}

function loadConfig(ui: UnixSessionEditorUi, config: UnixSessionConfiguration): void {
  let fixedConfig = config;
  if (config.shell == null) {
    fixedConfig = {
      uuid: config.uuid,
      name: config.name,
      useDefaultShell: true,
      shell: "",
      args: "",
      initialDirectory: ""
    };
  }

  ui.name = fixedConfig.name;
  ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
  ui.shell = fixedConfig.shell;
  ui.etcShells = etcShells;
  ui.args = fixedConfig.args;
  ui.initialDirectory = fixedConfig.initialDirectory || "";
}

function _dataChanged(sessionEditorBase: SessionEditorBase, ui: UnixSessionEditorUi): void {
  const config = <UnixSessionConfiguration> sessionEditorBase.sessionConfiguration;

  config.name = ui.name;
  config.useDefaultShell = ui.useDefaultShell === 1;
  config.shell = ui.shell;
  config.args = ui.args;
  config.initialDirectory = ui.initialDirectory;

  checkShellPath(ui);
  checkInitialDirectory(ui);

  sessionEditorBase.setSessionConfiguration(config);
}

function checkShellPath(_ui: UnixSessionEditorUi): void {
  if ( ! _ui.useDefaultShell && _ui.shell !== "") {
    const shellPath = _ui.shell;

    _checkExecutablePath(shellPath).then(resultMsg => {
      if (shellPath === _ui.shell) {
        _ui.shellErrorMsg = resultMsg;
      }
    });
  } else {
    _ui.shellErrorMsg = "";
  }
}

async function _checkExecutablePath(exePath: string): Promise<string> {
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

function checkInitialDirectory(_ui: UnixSessionEditorUi): void {
  if (_ui.initialDirectory !== "") {
    const initialDirectory = _ui.initialDirectory;

    checkDirectoryPath(initialDirectory).then(resultMsg => {
      if (initialDirectory === _ui.initialDirectory) {
        _ui.initialDirectoryErrorMsg = resultMsg;
      }
    });
  } else {
    _ui.initialDirectoryErrorMsg = "";
  }
}

async function checkDirectoryPath(exePath: string): Promise<string> {
  try {
    const metadata = await fse.stat(exePath);
    if ( ! metadata.isDirectory()) {
      return "Path isn't a directory";
    }

    await fse.access(exePath, fse.constants.R_OK);
  } catch(err) {
    if (err.errno === -constants.ENOENT) {
      return "Path doesn't exist";
    }
    if (err.errno === -constants.EACCES) {
      return "Path isn't readable";
    }
    return "errno: " +  err.errno + ", err.code: " + err.code;
  }
  return "";
}

const ETC_SHELLS = "/etc/shells";

async function readEtcShells(): Promise<string[]> {
  if (await fse.pathExists(ETC_SHELLS)) {
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
