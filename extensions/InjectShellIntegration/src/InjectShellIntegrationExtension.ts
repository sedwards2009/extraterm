/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, Logger, Terminal } from 'extraterm-extension-api';
import {BashScriptBuilder, FishScriptBuilder, ScriptCommand, ZshScriptBuilder} from './ScriptBuilders';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  // context.window.registerCommandsOnTerminal(terminalCommandLister, terminalCommandExecutor);
// FIXME
  const commands = context.commands;
  commands.registerCommand("inject-shell-integration:injectBashIntegration", () => {
    log.debug("Pretending to run command inject-shell-integration:injectBashIntegration");
  });
  commands.registerCommand("inject-shell-integration:injectFishIntegration", () => {
    log.debug("Pretending to run command inject-shell-integration:injectFishIntegration");
  });
  commands.registerCommand("inject-shell-integration:injectZshIntegration", () => {
    log.debug("Pretending to run command inject-shell-integration:injectZshIntegration");
  });

}

const COMMAND_INJECT_BASH_INTEGRATION = "injectBashIntegration";
const COMMAND_INJECT_FISH_INTEGRATION = "injectFishIntegration";
const COMMAND_INJECT_ZSH_INTEGRATION = "injectZshIntegration";

// function terminalCommandLister(terminal: Terminal): Command[] {
//   return [{
//     id: COMMAND_INJECT_BASH_INTEGRATION,
//     label: "Inject Bash Shell Integration"
//   },
//   {
//     id: COMMAND_INJECT_FISH_INTEGRATION,
//     label: "Inject Fish Shell Integration"
//   },
//   {
//     id: COMMAND_INJECT_ZSH_INTEGRATION,
//     label: "Inject Zsh Shell Integration"
//   }];
// }

async function terminalCommandExecutor(terminal: Terminal, commandId: string, commandArguments?: object): Promise<any> {
  const scriptCommands = getScriptCommands(terminal, commandId);
  executeScriptCommands(terminal, scriptCommands);
}

function getScriptCommands(terminal: Terminal, commandId: string): ScriptCommand[] {
  switch(commandId) {
    case COMMAND_INJECT_BASH_INTEGRATION:
      return new BashScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();

    case COMMAND_INJECT_FISH_INTEGRATION:
      return new FishScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();

    case COMMAND_INJECT_ZSH_INTEGRATION:
      return new ZshScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();

    default:
      return [];
  }
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
