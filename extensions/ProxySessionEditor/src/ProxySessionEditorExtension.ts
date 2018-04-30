/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import _ = require('lodash');

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
      this.updateSessionConfiguration(changes);
    }
  }

  context.workspace.registerSessionEditor("cygwin", ProxySessionEditor);
}
