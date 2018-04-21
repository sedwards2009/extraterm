/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');

import {ExtensionContext, Logger, SessionConfiguration} from 'extraterm-extension-api';
import {UnixSessionEditorUi} from './UnixSessionEditorUi';


let log: Logger = null;

interface UnixSessionConfiguration extends SessionConfiguration {
  useDefaultShell?: boolean;
  shell?: string;
}

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
      if (config.name == null) {
        this._loadConfig({
          uuid: config.uuid,
          name: "bash",
          useDefaultShell: true,
          shell: "",
        });
      }

      this._loadConfig(config);
      this.getContainerElement().appendChild(component.$el);
    }

    setSessionConfiguration(config: SessionConfiguration): void {
      super.setSessionConfiguration(config);
      this._loadConfig(config);
    }

    _loadConfig(config: UnixSessionConfiguration): void {
      this._ui.name = config.name;
      this._ui.useDefaultShell = config.useDefaultShell ? 1 :0;
      this._ui.shell = config.shell;
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
}
