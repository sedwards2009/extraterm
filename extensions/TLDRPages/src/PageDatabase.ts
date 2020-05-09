/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as fs from 'fs';


export interface PageInfo {
  command: string;
  name: string;
  platform: string;
  description: string;
  examples: CommandExample[];
}

export interface CommandExample {
  description: string;
  commandLine: string;
}

enum ParseState {
  INITIAL,
  EXAMPLE_BULLET,
}


export class PageDatabase {

  private _commandNameList: string[] = [];
  private _pageInfoList: PageInfo[] = [];
  private _pageInfoCache = new Map<string, PageInfo>();

  constructor(private _databasePath: string) {
  }

  async loadIndex(): Promise<void> {
    const pagesIndexPath = path.join(this._databasePath, "index.json");
    const indexJSONString = await fs.promises.readFile(pagesIndexPath, {encoding: "utf8"});
    const pageIndex = JSON.parse(indexJSONString);

    const commandList: string[] = [];
    const pageInfoList: PageInfo[] = [];
    for (const command of pageIndex.commands) {
      for (const platform of command.platform) {
        if (platform === "common") {
          commandList.push(command.name);
          pageInfoList.push({
            name: command.name,
            command: command.name,
            platform,
            description: null,
            examples: [],
          });
        } else {
          commandList.push(`${command.name} (${platform})`);
          pageInfoList.push({
            name: command.name,
            command: command.name,
            platform,
            description: null,
            examples: [],
          });
        }
      }
    }
    this._commandNameList = commandList;
    this._pageInfoList = pageInfoList;
  }

  getCommandNames(): string[] {
    return this._commandNameList;
  }

  async getPageInfoByName(commandName: string, platform: string): Promise<PageInfo> {
    const info = this._pageInfoList.find(info => info.command === commandName && info.platform === platform);
    if (info == null) {
      return null;
    }
    return this._getPageInfoByInfo(info);
  }

  async getPageInfoByIndex(commandIndex: number): Promise<PageInfo> {
    const info = this._pageInfoList[commandIndex];
    return this._getPageInfoByInfo(info);
  }

  private async _getPageInfoByInfo(commandInfo: PageInfo): Promise<PageInfo> {
    if (this._pageInfoCache.has(commandInfo.name)) {
      return this._pageInfoCache.get(commandInfo.name);
    }
    await this._fillInExamples(commandInfo);
    this._pageInfoCache.set(commandInfo.name, commandInfo);
    return commandInfo;
  }

  private async _fillInExamples(commandInfo: PageInfo): Promise<void> {
    const pagePath = path.join(this._databasePath, commandInfo.platform, `${commandInfo.name}.md`);
    const pageString = await fs.promises.readFile(pagePath, { encoding: "utf8" });
    const {description, examples } = this._parsePage(pageString);
    commandInfo.description = description;
    commandInfo.examples = examples;
  }

  private _parsePage(pageString: string): { description: string; examples: CommandExample[]; } {
    const lines = pageString.split("\n");
    let state: ParseState = ParseState.INITIAL;

    const examples: CommandExample[] = [];

    let description = "";
    let exampleDescription: string = null;

    for (const line of lines) {
      switch (state) {
        case ParseState.INITIAL:
          if (line.startsWith("- ")) {
            exampleDescription = line.substr(2);
            if (exampleDescription.endsWith(":")) {
              exampleDescription = exampleDescription.substr(0, exampleDescription.length - 1);
            }
            state = ParseState.EXAMPLE_BULLET;

          } else if (line.startsWith("> ")) {
            description = line.substr(2);
          }
          break;

        case ParseState.EXAMPLE_BULLET:
          if (line.trim().length === 0) {
            break;
          }

          let commandLine = line.trim();
          if (commandLine.startsWith("`")) {
            commandLine = commandLine.substr(1);
          }
          if (commandLine.endsWith("`")) {
            commandLine = commandLine.substr(0, commandLine.length - 1);
          }

          examples.push({
            description: exampleDescription,
            commandLine
          });
          state = ParseState.INITIAL;
          break;
      }
    }

    return { description, examples };
  }
}
