/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as path from "path";
import * as envPaths from "env-paths";

const EXTRATERM_CONFIG_DIR = "extraterm";
const paths = envPaths(EXTRATERM_CONFIG_DIR, {suffix: ""});

import { FileLogWriter, getLogger, addLogWriter } from "extraterm-logging";

const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";

const _log = getLogger("main");


async function main(): Promise<void> {
  console.log("Hello Qt World");
  console.log(`paths.config: ${paths.config}`);

  setupLogging();

  process.exit(0);
}

function setupLogging(): void {
  const logFilePath = path.join(paths.config, LOG_FILENAME);
  if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath);
  }

  const logWriter = new FileLogWriter(logFilePath);
  try {
    logWriter.open();
  } catch (error) {
    // The primary reason why this may happen is if an instance of Extraterm is already running.
    _log.warn(error);
    _log.warn("Unable to write to log file ", logFilePath);
    return;
  }

  addLogWriter(logWriter);
  _log.info("Recording logs to ", logFilePath);
}

main();
