/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { createUuid } from "extraterm-uuid";


let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  context.commands.registerCommand("ssh-quick-open:open", quickOpenCommand);
}

// Note: This is mostlyduplicated in SSHSessionEditorExtension.ts.
interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  authenticationMethod?: number; // AuthenticationMethod;
}

async function quickOpenCommand(): Promise<void> {
  const sshConnectionString = await context.activeTerminal.tab.showTextInput({
    message: "Enter a SSH connection string:",
    value: "",
  });
  if (sshConnectionString == null) {
    return;
  }

  const sshSessionConfiguration = parseConnectionString(sshConnectionString);
  context.commands.executeCommand("extraterm:window.newTerminal", {sessionConfiguration: sshSessionConfiguration});
}

function parseConnectionString(sshConnectionString: string): SSHSessionConfiguration {
  let username: string = null;

  const parts = sshConnectionString.split("@");
  let hostnamePort = sshConnectionString;
  if (parts.length === 2) {
    username = parts[0];
    hostnamePort = parts[1];
  }

  const hostPortParts = hostnamePort.split(":");
  let host: string = hostnamePort;
  let port = 22;
  if (hostPortParts.length === 2) {
    host = hostPortParts[0];
    const parsedPort = parseInt(hostPortParts[1], 10);
    if (! isNaN(parsedPort)) {
      port = parsedPort;
    }
  }

  return {
    uuid: createUuid(),
    name: sshConnectionString,
    type: "ssh",
    authenticationMethod: 0,
    host,
    port,
    username,
  };
}
