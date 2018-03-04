/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {CommandEntry, ExtensionContext, Logger, Terminal} from 'extraterm-extension-api';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  class TestViewer extends context.workspace.extensionViewerBaseConstructor {
    created(): void {
      super.created();

      const myDiv = document.createElement("DIV");
      myDiv.innerHTML = "Text Viewer Element calling in!";

      this.getContainerElement().appendChild(myDiv);
    }
  }

  context.workspace.registerViewer("TestViewer", TestViewer, ["foo/bar"]);
}

