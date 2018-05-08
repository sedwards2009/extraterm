/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext } from 'extraterm-extension-api';
import { CygwinProxyBackend } from './CygwinProxyBackend';
import { WslProxyBackend } from './WslProxyBackend';

export function activate(context: ExtensionContext): any {
  context.backend.registerSessionBackend("Cygwin", new CygwinProxyBackend(context.logger));
  context.backend.registerSessionBackend("WSL", new WslProxyBackend(context.logger));
}
