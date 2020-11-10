/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from "@extraterm/extraterm-extension-api";
import { cygwinProxySessionEditorFactory, init as cygwinInit } from "./CygwinProxySessionEditor";
import { init as wslInit, wslProxySessionEditorFactory } from "./WslProxySessionEditor";


export function activate(context: ExtensionContext): any {
  context.logger.info("ProxySessionEditorExtension activate");

  cygwinInit(context.logger);
  wslInit();
  context.window.registerSessionEditor("cygwin", cygwinProxySessionEditorFactory.bind(null, context.logger));
  context.window.registerSessionEditor("wsl", wslProxySessionEditorFactory.bind(null, context.logger));
}
