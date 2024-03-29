/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'node:path';
import * as fs from 'node:fs';


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
  PROLOGUE,
  DESCRIPTION,
  EXAMPLE_BULLET,
}


export class PageDatabase {

  #commandNameList: string[] = [];
  #pageInfoList: PageInfo[] = [];
  #pageInfoCache = new Map<string, PageInfo>();
  #databasePath: string;

  constructor(databasePath: string) {
    this.#databasePath = databasePath;
  }

  async loadIndex(): Promise<void> {
    const pagesIndexPath = path.join(this.#databasePath, "index.json");
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
    this.#commandNameList = commandList;
    this.#pageInfoList = pageInfoList;
  }

  getCommandNames(): string[] {
    return this.#commandNameList;
  }

  async getPageInfoByName(commandName: string, platform: string): Promise<PageInfo> {
    const info = this.#pageInfoList.find(info => info.command === commandName && info.platform === platform);
    if (info == null) {
      return null;
    }
    return this.#getPageInfoByInfo(info);
  }

  async getPageInfoByIndex(commandIndex: number): Promise<PageInfo> {
    const info = this.#pageInfoList[commandIndex];
    return this.#getPageInfoByInfo(info);
  }

  async #getPageInfoByInfo(commandInfo: PageInfo): Promise<PageInfo> {
    if (this.#pageInfoCache.has(commandInfo.name)) {
      return this.#pageInfoCache.get(commandInfo.name);
    }
    await this.#fillInExamples(commandInfo);
    this.#pageInfoCache.set(commandInfo.name, commandInfo);
    return commandInfo;
  }

  async #fillInExamples(commandInfo: PageInfo): Promise<void> {
    const pagePath = path.join(this.#databasePath, commandInfo.platform, `${commandInfo.name}.md`);
    const pageString = await fs.promises.readFile(pagePath, { encoding: "utf8" });
    const {description, examples } = this.#parsePage(pageString);
    commandInfo.description = description;
    commandInfo.examples = examples;
  }

  #parsePage(pageString: string): { description: string; examples: CommandExample[]; } {
    const lines = pageString.split("\n");
    let state: ParseState = ParseState.PROLOGUE;

    const examples: CommandExample[] = [];

    let description = "";
    let exampleDescription: string = null;

    for (const line of lines) {
      switch (state) {
        case ParseState.PROLOGUE:
          if (line.startsWith("> ")) {
            description = line.substr(2);
            state = ParseState.DESCRIPTION;
          }
          break;

        case ParseState.DESCRIPTION:
          if (line.startsWith("- ")) {
            exampleDescription = line.substr(2);
            if (exampleDescription.endsWith(":")) {
              exampleDescription = exampleDescription.substr(0, exampleDescription.length - 1);
            }
            state = ParseState.EXAMPLE_BULLET;
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
          state = ParseState.DESCRIPTION;
          break;
      }
    }

    return { description, examples };
  }
}
