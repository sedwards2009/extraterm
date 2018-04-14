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
  pythonExe?: string;
}

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("ProxySessionEditorExtension activate");
  
  class ProxySessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    private _ui: ProxySessionEditorUi = null;

    created(): void {
      super.created();

      this._ui = new ProxySessionEditorUi();
      const component = this._ui.$mount();
      this._ui.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false } );

      const config = <ProxySessionConfiguration> this.getSessionConfiguration();
      if (config.name == null) {
        this._ui.name = "Cygwin";
        this._ui.useDefaultShell = 1;
        this._ui.shell = "";
        this._ui.pythonExe = "";
      }

      this._ui.name = config.name;
      this._ui.useDefaultShell = config.useDefaultShell ? 1 :0;
      this._ui.shell = config.shell;
      this._ui.pythonExe = config.pythonExe;

      this.getContainerElement().appendChild(component.$el);
    }

    _dataChanged(): void {
      const changes = {
        name: this._ui.name,
        useDefaultShell: this._ui.useDefaultShell === 1,
        shell: this._ui.shell,
        pythonExe: this._ui.pythonExe
      };
      this.updateSessionConfiguration(changes);
    }
  }

  context.workspace.registerSessionEditor("cygwin", ProxySessionEditor);
}
