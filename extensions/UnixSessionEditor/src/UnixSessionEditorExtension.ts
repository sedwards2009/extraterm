/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import _ = require('lodash');

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

    created(): void {
      super.created();

      this._ui = new UnixSessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

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
        };
      }

      this._ui.name = fixedConfig.name;
      this._ui.useDefaultShell = fixedConfig.useDefaultShell ? 1 :0;
      this._ui.shell = fixedConfig.shell;
      this._ui.etcShells = etcShells;
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

  context.workspace.registerSessionEditor("unix", UnixSessionEditor);
  etcShells = readEtcShells();
}

const ETC_SHELLS = "/etc/shells";

function readEtcShells(): string[] {
  if (fs.existsSync(ETC_SHELLS)) {
    const shellText = fs.readFileSync("/etc/shells", "utf-8");

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
