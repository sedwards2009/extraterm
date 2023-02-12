
/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContext, Logger, SettingsTab } from '@extraterm/extraterm-extension-api';
// import { AlignmentFlag, QLabel, TextFormat } from '@nodegui/nodegui';
import * as https from 'node:https';
import { Config } from "./Config.js";
import { UpdateCheckerSettingsPage } from './UpdateCheckerSettingsPage.js';


let log: Logger = null;
let context: ExtensionContext = null;

let config: Config = null;
let timerId: NodeJS.Timeout = null;

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MILLIS = 7 * ONE_DAY_MILLIS;
const RELEASES_URL = 'https://extraterm.org/releases.json';

let settingsPage: UpdateCheckerSettingsPage = null;


interface ReleaseInfo {
  date: string;
  url: string;
  version: string;
  title: string;
}

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.commands.registerCommand("update-checker:check", checkCommand);
  context.settings.registerSettingsTab("update-checker-config", configTab);

  loadConfig();
}

function loadConfig(): void {
  config = context.configuration.get();
  if (config == null) {
    config = {
      frequency: 'never',
      lastCheck: 0,
      newVersion: null,
      newUrl: null
    };
  }
}

function setUpPoll(): void {
  timerId = setTimeout(pollAlarm, 60 * 1000);
}

function pollAlarm(): void {
  if (config.frequency !== 'never') {
    const deadline = config.lastCheck + (config.frequency === 'daily' ? ONE_DAY_MILLIS : ONE_WEEK_MILLIS);
    const now = Date.now();
    if (now > deadline) {
      checkCommand();
    }
  }
  setUpPoll();
}

let isFetchingReleaseJSON = false;
function setIsFetchingReleaseJSON(isFetching: boolean): void {
  isFetchingReleaseJSON = isFetching;
  if (settingsPage != null) {
    settingsPage.setIsFetchingReleaseJSON(isFetching);
  }
}

async function checkCommand(): Promise<void> {
  config.lastCheck = Date.now();
  context.configuration.set(config);

  setIsFetchingReleaseJSON(true);
  try {
    const jsonBody = await fetchUrl(RELEASES_URL);
    const releaseData: ReleaseInfo[] = JSON.parse(jsonBody);

    const latestVersion = releaseData[releaseData.length-1];
    if (latestVersion.version !== context.application.version) {
      config.newUrl = latestVersion.url;
      config.newVersion = latestVersion.version;

      context.configuration.set(config);
    }
  } catch(e) {
    log.warn(e);
  }
  setIsFetchingReleaseJSON(false);
}

function fetchUrl(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        log.warn(`Request to ${url} failed. Status Code: ${statusCode}`);
        res.resume();
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(rawData);
        } catch (e) {
          log.warn(e.message);
          reject(e);
        }
      });
    }).on('error', (e) => {
      log.warn(`Got error: ${e.message}`);
    });
  });
}

function configTab(extensionTab: SettingsTab): void {
  settingsPage = new UpdateCheckerSettingsPage(extensionTab, config, log);
  settingsPage.onConfigChanged((config) => {
    context.configuration.set(config);
  });
  settingsPage.onCheckNow(()=> {
    checkCommand();
  });
  settingsPage.setIsFetchingReleaseJSON(isFetchingReleaseJSON);
}
