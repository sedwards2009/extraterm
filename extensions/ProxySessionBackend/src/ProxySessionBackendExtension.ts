/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from 'extraterm-extension-api';
import { CygwinProxySessionBackend } from './CygwinProxySessionBackend';
import { WslProxySessionBackend } from './WslProxySessionBackend';

export function activate(context: ExtensionContext): any {
  context.backend.registerSessionBackend("Cygwin", new CygwinProxySessionBackend(context.logger));
  context.backend.registerSessionBackend("Windows Subsystem for Linux", new WslProxySessionBackend(context.logger));
}
