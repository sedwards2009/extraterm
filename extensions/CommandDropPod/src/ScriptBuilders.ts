/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';


abstract class ScriptBuilder {
  constructor(protected _extratermCookieName: string, protected _extratermCookieValue: string) {}

  build(): string {
    return this._buildCookie() + '\n' + this._buildCommands() + '\n' + this._buildShellReporting();
  }

  protected abstract _buildCookie(): string;

  protected abstract _buildShellReporting(): string;

  protected _buildCommands(): string {
    return this._buildScriptForCommand('from', 'exfrom') + this._buildScriptForCommand('show', 'exshow');
  }
    
  protected _buildScriptForCommand(commandName: string, commandPyFile: string): string {
    const flattener = new PythonFileFlattener(path.join(__dirname, '../../../src/commands/'));
    const script = flattener.readAndInlineCommand(commandPyFile);
    return this._formatCommand(commandName, script);
  }

  protected abstract _formatCommand(commandName: string, commandSource: string): string;

  protected _escapeShellChars(source): string {
    return source.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  }
}

const EOT = '\x04';

export class FishScriptBuilder extends ScriptBuilder {

  build(): string {
    return `source
${super.build()}
${EOT}`;
  }

  protected _buildCookie(): string {
    return `set -x ${this._extratermCookieName} ${this._extratermCookieValue}`;
  }

  protected _buildShellReporting(): string {
    return `
function extraterm_preexec -e fish_preexec
  echo -n -e -s "\\033&" $${this._extratermCookieName} ";2;fish\\007"
  echo -n $argv[1]
  echo -n -e "\\000"
end

function extraterm_postexec -e fish_postexec
  set -l status_backup $status
  echo -n -e -s "\\033" "&" $${this._extratermCookieName} ";3\\007"
  echo -n $status_backup
  echo -n -e "\\000"
end
`;
  }

  protected _formatCommand(commandName: string, commandSource: string): string {
    return `function ${commandName}
  python3 -c '${this._escapeShellChars(commandSource)}' $argv
end
`;
  }
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
