
/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, CommandEntry, Terminal, Logger} from 'extraterm-extension-api';


let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.workspace.registerCommandsOnTerminal(terminalCommandLister, terminalCommandExecutor);
}

const COMMAND_DROP_COMMAND_POD = "dropCommandPod";

function terminalCommandLister(terminal: Terminal): CommandEntry[] {
  return [{
    id: COMMAND_DROP_COMMAND_POD,
    label: "Drop Command Pod"
  }];
}

async function terminalCommandExecutor(terminal: Terminal, commandId: string, commandArguments?: object): Promise<any> {

  for (const viewer of terminal.getViewers()) {
    if (viewer.viewerType === 'terminal-output') {
      log.info("Viewer",viewer,"is live=",viewer.isLive());
    }
  }

  terminal.type("ps -o pid,ppid,command\n");
  // echo $BASH $SHELL
}
