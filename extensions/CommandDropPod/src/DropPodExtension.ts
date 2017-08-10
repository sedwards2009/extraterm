/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, CommandEntry, Terminal, Logger} from 'extraterm-extension-api';
import {FishScriptBuilder} from './ScriptBuilders';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.workspace.registerCommandsOnTerminal(terminalCommandLister, terminalCommandExecutor);
}

const COMMAND_DROP_FISH_COMMAND_POD = "dropFishCommandPod";

function terminalCommandLister(terminal: Terminal): CommandEntry[] {
  return [{
    id: COMMAND_DROP_FISH_COMMAND_POD,
    label: "Drop Command Pod (fish)"
  }];
}

async function terminalCommandExecutor(terminal: Terminal, commandId: string, commandArguments?: object): Promise<any> {
  let script = "";
  switch(commandId) {
    case COMMAND_DROP_FISH_COMMAND_POD:
      script = new FishScriptBuilder(terminal.getExtratermCookieName(), terminal.getExtratermCookieValue()).build();
      break;

    default:
      return;
  }
  terminal.type(script);
}
