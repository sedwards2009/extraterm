/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
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

interface LogMessage {
  level: string;
  msg: string;
}

class Logger {
  
  private _name: string;
  
  private _recording = false;

  private _messageLog: LogMessage[] = [];
  
  /**
   * Contruct a logger.
   * 
   * @param  name the name of the code or class associated with this logger instance.
   * @return the new logger instance
   */
  constructor(name?: string) {
    const baseName = name === undefined ? "(unknown)" : name;
    const instanceCount = instanceCounter.has(baseName) ? instanceCounter.get(baseName) + 1 : 0;
    instanceCounter.set(baseName, instanceCount);
    this._name = baseName + " #" + instanceCount;
  }
  
  /**
   * Log a debug message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  debug(msg: any, ...opts: any[]): void {
    this._log("DEBUG", msg, opts);
  }
  
  /**
   * Log an info message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  info(msg: any, ...opts: any[]): void {
    this._log("INFO", msg, opts);
  }
  
  /**
   * Log a warning message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  warn(msg: any, ...opts: any[]): void {
    this._log("WARN", msg, opts);
  }
  
  /**
   * Log a severe message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  severe(msg: any, ...opts: any[]): void {
    this._log("SEVERE", msg, opts);
  }
  
  /**
   * Turns on recording log messages to an internal buffer.
   *
   * Messages are still sent to the console when recording is on.
   * See `stopRecording()` and `getLogMessages()`.
   */
  startRecording(): void {
    this._recording = true;    
  }
  
  /**
   * Turns off recording log messages to the internal buffer.
   *
   * See `startRecording()` and `getLogMessages()`.
   */
  stopRecording(): void {
    this._recording = false;
  }
  
  /**
   * Starts timing.
   *
   * See endTime().
   *
   * @param label identifying label for this timer
   */
  startTime(label: string): void {
    console.time(label);
  }
  
  /**
   * Ends timing.
   *
   * Prints the timing result to the log. Label should be the same as the label given to startTime().
   *
   * @param label identifying label for the timer to end
   */
  endTime(label: string): void {
    console.timeEnd(label);
  }  
  
  /**
   * Gets the recorded log messages as a string.
   *
   * @return the record messages as string holding multiple lines
   */
  getFormattedLogMessages(): string {
    return this._messageLog.reduce( (accu, logMessage) => accu + "\n" + logMessage.msg, "");
  }
  
  private _log(level: string, msg: string, opts: any[]): void {
    const formatted = this._format(level, msg);
    if (this._recording) {
      this._messageLog.push( { level, msg: formatted + opts.reduce( (x, accu) => accu + x + ", ", "") } );
    }
    console.log(formatted, ...opts);
  }
  
  private _format(level: string, msg: string): string {
    return `${(new Date()).toISOString().replace(/(T|Z)/g," ").trim()} ${level} [${this._name}] ${msg}`;
  }
}

export = Logger;
