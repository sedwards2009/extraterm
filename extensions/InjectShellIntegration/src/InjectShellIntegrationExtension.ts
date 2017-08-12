/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {CommandEntry, ExtensionContext, Logger, Terminal} from 'extraterm-extension-api';
import {BashScriptBuilder, FishScriptBuilder, ZshScriptBuilder} from './ScriptBuilders';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.workspace.registerCommandsOnTerminal(terminalCommandLister, terminalCommandExecutor);
}

const COMMAND_INJECT_BASH_INTEGRATION = "injectBashIntegration";
const COMMAND_INJECT_FISH_INTEGRATION = "injectFishIntegration";
const COMMAND_INJECT_ZSH_INTEGRATION = "injectZshIntegration";

function terminalCommandLister(terminal: Terminal): CommandEntry[] {
  return [{
    id: COMMAND_INJECT_BASH_INTEGRATION,
    label: "Inject Bash Shell Integration"
  },
  {
    id: COMMAND_INJECT_FISH_INTEGRATION,
    label: "Inject Fish Shell Integration"
  },
  {
    id: COMMAND_INJECT_ZSH_INTEGRATION,
    label: "Inject Zsh Shell Integration"
  }];
}

async function terminalCommandExecutor(terminal: Terminal, commandId: string, commandArguments?: object): Promise<any> {
  let script = "";
  switch(commandId) {
    case COMMAND_INJECT_BASH_INTEGRATION:
      script = new BashScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
      break;

    case COMMAND_INJECT_FISH_INTEGRATION:
      script = new FishScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
      break;

    case COMMAND_INJECT_ZSH_INTEGRATION:
      script = new ZshScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
      break;

    default:
      return;
  }
  terminal.type(normalizeCarriageReturns(script));
}

function normalizeCarriageReturns(text: string): string {
  return text.replace(/\n/g, '\r');
}
