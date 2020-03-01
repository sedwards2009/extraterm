/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal } from '@extraterm/extraterm-extension-api';
import {BashScriptBuilder, FishScriptBuilder, ScriptCommand, ZshScriptBuilder} from './ScriptBuilders';

let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;

  const commands = context.commands;
  commands.registerCommand("inject-shell-integration:injectBashIntegration", () => {
    const terminal = context.window.activeTerminal;
    const scriptCommands = new BashScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
    executeScriptCommands(terminal, scriptCommands);    
  });

  commands.registerCommand("inject-shell-integration:injectFishIntegration", () => {
    const terminal = context.window.activeTerminal;
    const scriptCommands = new FishScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
    executeScriptCommands(terminal, scriptCommands);    
  });

  commands.registerCommand("inject-shell-integration:injectZshIntegration", () => {
    const terminal = context.window.activeTerminal;
    const scriptCommands = new ZshScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
    executeScriptCommands(terminal, scriptCommands);    
  });
}

async function executeScriptCommands(terminal: Terminal, scriptCommands: ScriptCommand[]): Promise<void> {
  for (const command of scriptCommands) {
    if (command.type === 'text') {
      terminal.type(normalizeCarriageReturns(command.text));
    } else {
      await sleepMilliseconds(command.durationMilliseconds);
    }
  }
}

function normalizeCarriageReturns(text: string): string {
  return text.replace(/\n/g, '\r');
}

function sleepMilliseconds(durationMilliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMilliseconds);    
  });
}
