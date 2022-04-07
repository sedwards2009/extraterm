/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from "@extraterm/extraterm-extension-api";
import { init as wslInit, wslProxySessionEditorFactory } from "./WslProxySessionEditor.js";


export function activate(context: ExtensionContext): any {
  context.logger.info("ProxySessionEditorExtension activate");

  wslInit();
  context.sessions.registerSessionEditor("wsl", wslProxySessionEditorFactory.bind(null, context.logger));
}
