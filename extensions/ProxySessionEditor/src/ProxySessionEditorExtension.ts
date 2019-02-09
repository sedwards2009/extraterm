/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from 'extraterm-extension-api';
import { getCygwinProxySessionEditorClass } from './CygwinProxySessionEditor';
import { getWslProxySessionEditorClass } from './WslProxySessionEditor';


export function activate(context: ExtensionContext): any {
  context.logger.info("ProxySessionEditorExtension activate");
  context.window.registerSessionEditor("cygwin", getCygwinProxySessionEditorClass(context));
  context.window.registerSessionEditor("wsl", getWslProxySessionEditorClass(context));
}
