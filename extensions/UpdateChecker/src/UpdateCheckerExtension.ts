
/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionContext, Logger, SettingsTab } from '@extraterm/extraterm-extension-api';
// import { AlignmentFlag, QLabel, TextFormat } from '@nodegui/nodegui';
import * as https from 'node:https';
import { Config } from "./Config.js";


let log: Logger = null;
let context: ExtensionContext = null;

let config: Config = null;
let timerId: NodeJS.Timeout = null;

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MILLIS = 7 * ONE_DAY_MILLIS;
const RELEASE_URL = 'https://extraterm.org/releases.json';


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
      lastCheck: 0
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

function checkCommand(): void {
  config.lastCheck = Date.now();
  context.configuration.set(config);

  https.get(RELEASE_URL, (res) => {
    const { statusCode } = res;
    if (statusCode !== 200) {
      log.warn(`Request to ${RELEASE_URL} failed. Status Code: ${statusCode}`);
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
        log.info(rawData);
        const parsedData = JSON.parse(rawData);

        log.info(parsedData);

      } catch (e) {
        log.warn(e.message);
      }
    });
  }).on('error', (e) => {
    log.warn(`Got error: ${e.message}`);
  });
}



function configTab(extensionTab: SettingsTab): void {

}
