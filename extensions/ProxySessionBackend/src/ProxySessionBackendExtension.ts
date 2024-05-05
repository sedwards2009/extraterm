/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from '@extraterm/extraterm-extension-api';
import { CygwinProxySessionBackend } from './CygwinProxySessionBackend.js';
import { WslProxySessionBackend } from './WslProxySessionBackend.js';

export function activate(context: ExtensionContext): any {
  context.sessions.registerSessionBackend("cygwin", new CygwinProxySessionBackend(context.logger));
  context.sessions.registerSessionBackend("wsl", new WslProxySessionBackend(context.logger));
}
