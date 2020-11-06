/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Logging support for inside Electron apps.
 *
 * Instances of this class can be made for different parts of the program
 * code. Logger instances with the same name are made unique by use a counter.
 */

const instanceCounter = new Map<string, number>();
const instanceNames = new WeakMap<any, string>(); // Maps objects to the names used by their loggers.
const loggersMap = new WeakMap<any, Logger>();

let logLifecycle = false;

export type Level = 'DEBUG' | 'INFO' | 'WARN' | 'SEVERE';


interface LogMessage {
  level: Level;
  msg: string;
}

/**
 * Turn on/off logging of object lifecycles.
 *
 * When this is turned on, the creation of new logger objects will be logged
 * and also when they are garbage collected.
 *
 * Defaults to off.
 *
 * @param on Set this to `true` if object lifecycles
 */
export function setLogObjectLifecycles(on: boolean): void {
  logLifecycle = on;
}

export interface LogWriter {
  write(level: Level, msg: string, ...opts: any[]): void;
}


export interface Logger {
  /**
   * Get the unique name of this logger instance.
   *
   * @return the name of this instance
   */
  getName(): string;

  /**
   * Log a debug message.
   *
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  debug(msg: any, ...opts: any[]): void;

  /**
   * Log an info message.
   *
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  info(msg: any, ...opts: any[]): void;

  /**
   * Log a warning message.
   *
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  warn(msg: any, ...opts: any[]): void;

  /**
   * Log a severe message.
   *
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  severe(msg: any, ...opts: any[]): void;

  /**
   * Turns on recording log messages to an internal buffer.
   *
   * Messages are still sent to the console when recording is on.
   * See `stopRecording()` and `getLogMessages()`.
   */
  startRecording(): void;

  /**
   * Turns off recording log messages to the internal buffer.
   *
   * See `startRecording()` and `getLogMessages()`.
   */
  stopRecording(): void;

  /**
   * Starts timing.
   *
   * See endTime().
   *
   * @param label identifying label for this timer
   */
  startTime(label: string): void;

  /**
   * Ends timing.
   *
   * Prints the timing result to the log. Label should be the same as the label given to startTime().
   *
   * @param label identifying label for the timer to end
   */
  endTime(label: string): void;

  /**
   * Gets the recorded log messages as a string.
   *
   * @return the record messages as string holding multiple lines
   */
  getFormattedLogMessages(): string;
}


const finalizationRegistry = new FinalizationRegistry( (log: Logger) => {
  log.debug(`Object destroyed.`);
});


export function getLogger(name?: string, instance?: any): Logger {
  if (instance != null) {
    if (loggersMap.has(instance)) {
      return loggersMap.get(instance);
    }

    const baseName = name === undefined ? "(unknown)" : name;
    const instanceCount = instanceCounter.has(baseName) ? instanceCounter.get(baseName) + 1 : 0;
    instanceCounter.set(baseName, instanceCount);
    const loggerName = baseName + " #" + instanceCount;

    if (instance != null) {
      instanceNames.set(instance, loggerName);
    }
    const logger = new LoggerImpl(loggerName);
    loggersMap.set(instance, logger);
    if (logLifecycle) {
      finalizationRegistry.register(instance, logger);
      logger.debug("Object created.");
    }
    return logger;
  }

  return new LoggerImpl(name);
}


/**
 * Try to map an object to a human understandable name.
 *
 * @param obj the object
 * @return the name of the object or null if one could not be found.
 */
export function objectName(obj: any): string {
  const name = instanceNames.get(obj);
  return name === undefined ? null : name;
}


const logWriters: LogWriter[] = [];

export function addLogWriter(writer: LogWriter): void {
  logWriters.push(writer);
}


class LoggerImpl implements Logger {
  private _recording = false;
  private _messageLog: LogMessage[] = [];

  /**
   * Construct a logger.
   *
   * @param  name the name of the code or class associated with this logger instance.
   * @return the new logger instance
   */
  constructor(private _name: string) {
  }

  getName(): string {
    return this._name;
  }

  debug(msg: any, ...opts: any[]): void {
    this._logMessage("DEBUG", msg, opts);
  }

  info(msg: any, ...opts: any[]): void {
    this._logMessage("INFO", msg, opts);
  }

  warn(msg: any, ...opts: any[]): void {
    this._logMessage("WARN", msg, opts);
  }

  severe(msg: any, ...opts: any[]): void {
    this._logMessage("SEVERE", msg, opts);
  }

  startRecording(): void {
    this._recording = true;
  }

  stopRecording(): void {
    this._recording = false;
  }

  startTime(label: string): void {
    console.time(label);
  }

  endTime(label: string): void {
    console.timeEnd(label);
  }

  getFormattedLogMessages(): string {
    return this._messageLog.reduce( (accu, logMessage) => accu + "\n" + logMessage.msg, "");
  }

  private _logMessage(level: Level, msg: string, opts: any[]): void {
    const formatted = this._format(level, msg);
    if (this._recording) {
      this._messageLog.push( { level, msg: formatted + opts.reduce( (x, accu) => accu + x + ", ", "") } );
    }

    for (let i = 0; i < logWriters.length; i++) {
      logWriters[i].write(level, formatted, ...opts);
    }
  }

  private _format(level: string, msg: string): string {
    return `${(new Date()).toISOString().replace(/(T|Z)/g," ").trim()} ${level} [${this._name}] ${msg}`;
  }
}

class ConsoleLogWriter implements LogWriter {
  write(level: Level, msg: string, ...opts: any[]): void {
    switch (level) {
      case "DEBUG":
      case "INFO":
        console.log(msg, ...opts);
        break;
      case "WARN":
        console.warn(msg, ...opts);
        break;
      case "SEVERE":
        console.error(msg, ...opts);
        break;
    }
  }
}

addLogWriter(new ConsoleLogWriter());
