/*
 * Copyright 2025 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { createUuid } from "extraterm-uuid";

// Most Recently Used list length.
const MRU_LENGTH = 10;
interface Config {
  mru: string[];
}

let log: Logger = null;
let context: ExtensionContext = null;
let config: Config = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;
  loadConfig();
  context.commands.registerCommand("ssh-quick-open:open", quickOpenCommand);
}

function loadConfig(): void {
  config = context.configuration.get();
  if (config == null) {
    config = {
      mru: []
    };
  }
}

// Note: This is mostly duplicated in SSHSessionEditorExtension.ts.
interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  authenticationMethod?: number; // AuthenticationMethod;
}

async function quickOpenCommand(): Promise<void> {
  const sshConnectionString = await context.activeTab.showTextInput({
    message: "Enter a SSH connection string:",
    value: "",
    suggestions: config.mru
  });
  if (sshConnectionString == null) {
    return;
  }

  updateMRU(sshConnectionString);

  const sshSessionConfiguration = parseConnectionString(sshConnectionString);
  context.commands.executeCommand("extraterm:window.newTerminal", {sessionConfiguration: sshSessionConfiguration});
}

function updateMRU(sshConnectionString: string): void {
  const index = config.mru.indexOf(sshConnectionString);
  if (index !== -1) {
    config.mru.splice(index, 1);
  }
  config.mru.unshift(sshConnectionString);

  if (config.mru.length > MRU_LENGTH) {
    config.mru = config.mru.slice(0, MRU_LENGTH);
  }
  context.configuration.set(config);
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
