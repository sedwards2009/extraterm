/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as SourceMapSupport from "source-map-support";

import * as fs from "fs";
import * as path from "path";

import { Window } from "./Window";

import { FileLogWriter, getLogger, addLogWriter, Logger } from "extraterm-logging";
import { PersistentConfigDatabase } from "./config/PersistentConfigDatabase";
import { SharedMap } from "./shared_map/SharedMap";
import { getUserSettingsDirectory, setupAppData } from "./config/MainConfig";

const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";

const PACKAGE_JSON_PATH = "../../package.json";


/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
class Main {

  private _log: Logger = null;
  #windows: Window[] = [];

  constructor() {
    this._log = getLogger("main", this);
  }

  init(): void {
    setupAppData();

    const sharedMap = new SharedMap();
    const configDatabase = new PersistentConfigDatabase(getUserSettingsDirectory(), sharedMap);
    configDatabase.start();

    this.setupLogging();

    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "utf8"));

    // We have to start up the extension manager before we can scan themes (with the help of extensions)
    // and properly sanitize the config.
    // const extensionManager = setupExtensionManager(configDatabase, packageJson.version);

    this.openWindow();

    // process.exit(0);
  }

  setupLogging(): void {
    const logFilePath = path.join(getUserSettingsDirectory(), LOG_FILENAME);
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }

    const logWriter = new FileLogWriter(logFilePath);
    try {
      logWriter.open();
    } catch (error) {
      // The primary reason why this may happen is if an instance of Extraterm is already running.
      this._log.warn(error);
      this._log.warn("Unable to write to log file ", logFilePath);
      return;
    }

    addLogWriter(logWriter);
    this._log.info("Recording logs to ", logFilePath);
  }

  openWindow(): void {
    const win = new Window();
    this.#windows.push(win);
    win.open();
  }
}

const main =  new Main();
main.init();
(global as any).main = main;
