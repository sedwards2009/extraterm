/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import * as child_process from "child_process";

import { Logger, SessionConfiguration, SessionEditorBase } from "@extraterm/extraterm-extension-api";
import { WslProxySessionEditorUi } from "./WslProxySessionEditorUi";


interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
  distribution?: string;
}

export function init(): void {
  readEtcShellsSpawn();
  readDistributionsSpawn();
}

export function wslProxySessionEditorFactory(log: Logger, sessionEditorBase: SessionEditorBase): any {
  const ui = new WslProxySessionEditorUi();
  const debouncedDataChanged = _.debounce(dataChanged.bind(null, sessionEditorBase, ui), 500);

  const component = ui.$mount();
  ui.$watch("$data", debouncedDataChanged, { deep: true, immediate: false } );

  const config = <WslProxySessionConfiguration> sessionEditorBase.sessionConfiguration;
  loadConfig(ui, config);

  sessionEditorBase.containerElement.appendChild(component.$el);
}

function loadConfig(ui: WslProxySessionEditorUi, config: WslProxySessionConfiguration): void {
  let fixedConfig = config;
  if (config.shell == null) {
    fixedConfig = {
      uuid: config.uuid,
      name: config.name,
      useDefaultShell: true,
      shell: "",
      args: "",
      initialDirectory: "",
      distribution: "",
    };
  }

  ui.name = fixedConfig.name;
  ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
  ui.shell = fixedConfig.shell;
  ui.etcShells = [...etcShells];
  ui.distribution = fixedConfig.distribution == null ? "" : fixedConfig.distribution;
  ui.distributions = [...distributions];
  ui.args = fixedConfig.args;
  ui.initialDirectory = fixedConfig.initialDirectory || "";
}

function dataChanged(sessionEditorBase: SessionEditorBase, ui: WslProxySessionEditorUi): void {
  const config = <WslProxySessionConfiguration> sessionEditorBase.sessionConfiguration;

  config.name = ui.name;
  config.useDefaultShell = ui.useDefaultShell === 1;
  config.shell = ui.shell;
  config.args = ui.args;
  config.initialDirectory = ui.initialDirectory;
  config.distribution = ui.distribution;

  sessionEditorBase.setSessionConfiguration(config);
}

let etcShells: string[] = [];

function readEtcShellsSpawn(): void {
  spawnWsl(["cat", "/etc/shells"], "utf8", splitEtcShells);
}

function spawnWsl(parameters: string[], encoding: string, onExit: (text: string) => void): void {
  // For some reason child_process.exec() doesn't want to work properly on Windows.
  // spawn still does though, but it is a bit more fiddly to use.
  const wslProcess = child_process.spawn("wsl.exe", parameters, {shell: false, stdio: "pipe"});

  let text = "";
  wslProcess.stdout.on("data", data => {
    text += data.toString(encoding);
  });
  wslProcess.on("exit", (msg) => {
    onExit(text);
  });
  wslProcess.stdin.end();
}

function splitEtcShells(shellText: string): void {
  const lines = shellText.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ( ! line.startsWith("#") && line.trim() !== "") {
      result.push(line);
    }
  }
  etcShells = result;
}

let distributions: string[] = [];

function readDistributionsSpawn(): void {
  spawnWsl(["--list"], "utf16le", splitDistributions);
}

function splitDistributions(text: string): void {
  const lines = text.split("\n");
  const result: string[] = [""];
  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      continue;
    }
    const parts = line.split(" ");
    result.push(parts[0].trim());
  }
  distributions = result;
}
