/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import * as constants from 'constants';
import * as child_process from 'child_process';

import {ExtensionContext, Logger, SessionConfiguration} from 'extraterm-extension-api';
import {WslProxySessionEditorUi} from './WslProxySessionEditorUi';


interface WslProxySessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

let log: Logger = null;

export function getWslProxySessionEditorClass(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("WslProxySessionEditorExtension activate");
  readEtcShellsSpawn();

  class WslProxySessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: WslProxySessionEditorUi = null;
    private _debouncedDataChanged: ()=> void = null;

    created(): void {
      super.created();

      this._debouncedDataChanged = _.debounce(this._dataChanged.bind(this), 500);

      this._ui = new WslProxySessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._debouncedDataChanged.bind(this), { deep: true, immediate: false } );

      const config = <WslProxySessionConfiguration> this.getSessionConfiguration();
      this._loadConfig(config);

      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: WslProxySessionConfiguration): void {
      let fixedConfig = config;
      if (config.shell == null) {
        fixedConfig = {
          uuid: config.uuid,
          name: config.name,
          useDefaultShell: true,
          shell: "",
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
      this._ui.shell = fixedConfig.shell;
      this._ui.etcShells = [...etcShells];
    }

    _dataChanged(): void {
      const changes = {
        name: this._ui.name,
        useDefaultShell: this._ui.useDefaultShell === 1,
        shell: this._ui.shell
      };
      this.updateSessionConfiguration(changes);
    }
  }

  return WslProxySessionEditor;
}

let etcShells: string[] = [];

function readEtcShellsSpawn(): void {
  // For some reason child_process.exec() doesn't want to work properly on Windows.
  // spawn still does though, but it is a bit more fiddly to use.

  const wslProcess = child_process.spawn("wsl.exe", ["cat", "/etc/shells"], {shell: false, stdio: 'pipe'});

  let text = "";
  wslProcess.stdout.on("data", data => {
    text += data;
  });
  wslProcess.on("exit", (msg) => {
    etcShells = splitEtcShells(text);
  });
  wslProcess.stdin.end();
}

function splitEtcShells(shellText: string): string[] {
  const lines = shellText.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ( ! line.startsWith("#") && line.trim() !== "") {
      result.push(line);
    }
  }
  return result;
}
