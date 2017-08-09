
/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';
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
      log.info('Viewer',viewer,'is live=',viewer.isLive());
    }
  }

  terminal.type('ps -o pid,ppid,command\n');
  // echo $BASH $SHELL
}


export class PythonFileFlattener {
  constructor(private _baseDir: string) {}

  readAndInlineCommand(commandName: string): string {
    const commandSourceCode = fs.readFileSync(path.join(this._baseDir, commandName + ".py"), 'UTF-8');

    const lines = commandSourceCode.split('\n');
    const filteredLines:string[] = [];
    let inlineNextState = false;
    for (const line of lines) {
      if ( ! inlineNextState) {
        if (line.trim().startsWith('##@inline')) {
          inlineNextState = true;
        }
        filteredLines.push(line);
      } else {
        filteredLines.push.apply(filteredLines, this._expandImport(line));
        inlineNextState = false;
      }
    }

    return this._removeDuplicateImports(filteredLines).join('\n');
  }

  private _expandImport(line: string): string[] {
    const importTarget = this._extractTargetFromImportLine(line);

    const librarySourceCode = fs.readFileSync(path.join(this._baseDir, importTarget + ".py"), 'UTF-8');
    const librarySourceLines = librarySourceCode.split('\n');

    return librarySourceLines;
  }

  private _extractTargetFromImportLine(line: string): string {
    if (line.startsWith('from ')) {
      const parts = line.slice('from '.length).split(' ');
      return parts[0];
    }
    return '';
  }

  private _removeDuplicateImports(lines: string[]): string[] {
    const result: string[] = [];
    const seenImports = new Set<string>();
    for (const line of lines) {
      if (line.startsWith('import ')) {
        const importTarget = line.slice('import '.length);
        if ( ! seenImports.has(importTarget)) {
          seenImports.add(importTarget);
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }
    return result;
  }
}
