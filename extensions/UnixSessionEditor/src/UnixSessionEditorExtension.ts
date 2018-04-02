/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {BulkFileHandle, BulkFileState, CommandEntry, ExtensionContext, Logger, Terminal} from 'extraterm-extension-api';
// import {AudioViewerUi} from './AudioViewerUi';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  
  log.info("UnixSessionEditorExtension activate");
  
  class UnixSessionEditor extends context.workspace.extensionSessionEditorBaseConstructor {
    // private _ui: UnixSessionEditorUi = null;

    created(): void {
      super.created();

      // this._ui = new UnixSessionEditorUi();
      // const component = this._ui.$mount();
      // this.getContainerElement().appendChild(component.$el);
  
    }
  }

  context.workspace.registerSessionEditor("unix", UnixSessionEditor);
}
