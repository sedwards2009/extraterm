/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import * as constants from 'constants';

import {ExtensionContext, Logger, SessionConfiguration, SessionEditorBase} from '@extraterm/extraterm-extension-api';
import {WindowsConsoleSessionEditorUi} from './WindowsConsoleSessionEditorUi';


let log: Logger = null;

interface WindowsConsoleSessionConfiguration extends SessionConfiguration {
  exe?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.window.registerSessionEditor("windows-console", SessionEditorFactory);
}

function SessionEditorFactory(sessionEditorBase: SessionEditorBase): void {
  const ui = new WindowsConsoleSessionEditorUi();
  const debouncedDataChanged = _.debounce(dataChanged.bind(null, sessionEditorBase, ui), 500);

  const component = ui.$mount();
  ui.$watch('$data', debouncedDataChanged, { deep: true, immediate: false } );

  const config = <WindowsConsoleSessionConfiguration> sessionEditorBase.getSessionConfiguration();
  loadConfig(ui, config);

  sessionEditorBase.getContainerElement().appendChild(component.$el);

  initializeAvailableExes(ui);
}

function loadConfig(ui: WindowsConsoleSessionEditorUi, config: WindowsConsoleSessionConfiguration): void {
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

  ui.name = fixedConfig.name;
  ui.exe = fixedConfig.exe;
  ui.args = fixedConfig.args;
  ui.initialDirectory = fixedConfig.initialDirectory || "";
}

function dataChanged(sessionEditorBase: SessionEditorBase, ui: WindowsConsoleSessionEditorUi): void {
  const config = <WindowsConsoleSessionConfiguration> sessionEditorBase.getSessionConfiguration();
  config.name = ui.name;
  config.exe = ui.exe;
  config.args = ui.args;
  config.initialDirectory = ui.initialDirectory;

  checkExeField(ui);
  checkInitialDirectory(ui);
  sessionEditorBase.setSessionConfiguration(config);
}

function checkExeField(ui: WindowsConsoleSessionEditorUi): void {
  if (ui.exe !== "") {
    const exePath = ui.exe;

    checkExe(exePath).then(resultMsg => {
      if (exePath === ui.exe) {
        ui.exeErrorMsg = resultMsg;
      }
    });
  } else {
    ui.exeErrorMsg = "";
  }
}

async function checkExe(exe: string): Promise<string> {
  if (path.isAbsolute(exe)) {
    return checkExecutablePath(exe);
  }

  const searchPaths: string[] = process.env.PATH.split(";");
  for (const p of searchPaths) {
    const testPath = path.join(p, exe);
    const result = await checkExecutablePath(testPath);
    if (result === "") {
      return "";
    }
  }
  return "Couldn't find executable";
}

async function checkExecutablePath(exePath: string): Promise<string> {
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

async function initializeAvailableExes(ui: WindowsConsoleSessionEditorUi): Promise<void> {
  const availableExes: string[] = [];
  for (const exePath of ["cmd.exe", "powershell.exe", "pwsh.exe"]) {
    const errorMsg = await checkExe(exePath);
    if (errorMsg === "") {
      availableExes.push(exePath);
    }
  }
  ui.availableExes = availableExes;
}

function checkInitialDirectory(ui: WindowsConsoleSessionEditorUi): void {
  if (ui.initialDirectory !== "") {
    const initialDirectory = ui.initialDirectory;

    checkDirectoryPath(initialDirectory).then(resultMsg => {
      if (initialDirectory === ui.initialDirectory) {
        ui.initialDirectoryErrorMsg = resultMsg;
      }
    });
  } else {
    ui.initialDirectoryErrorMsg = "";
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
