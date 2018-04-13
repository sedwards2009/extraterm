/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable, Event, SessionConfiguration} from 'extraterm-extension-api';
import * as _ from 'lodash';

import {Pty, BufferSizeChange} from '../../pty/Pty';
import {PtyConnector, PtyOptions, EnvironmentMap} from './PtyConnector';
import { Config, AcceptsConfigDistributor, ConfigDistributor } from '../../Config';
import { Logger, getLogger } from '../../logging/Logger';
// Our special 'fake' module which selects the correct pty connector factory implementation.
const PtyConnectorFactory = require("../pty/PtyConnectorFactory");

import * as Messages from '../../WindowMessages';
import * as Util from '../../render_process/gui/Util';
import { EventEmitter } from '../../utils/EventEmitter';
import { MainExtensionManager } from '../extension/MainExtensionManager';
import log from '../../logging/LogDecorator';
import { createUuid } from 'extraterm-uuid';

const LOG_FINE = false;

interface PtyTuple {
  ptyTerm: Pty;
  outputBufferSize: number; // The number of characters we are allowed to send.
  outputPaused: boolean;    // True if the term's output is paused.
};

export interface PtyDataEvent {
  ptyId: number;
  data: string;
}

export interface PtyAvailableWriteBufferSizeChangeEvent {
  ptyId: number;
  bufferSizeChange: BufferSizeChange;
}

export class PtyManager implements Disposable, AcceptsConfigDistributor {
  private _log: Logger;
  private _configDistributor: ConfigDistributor = null;
  private _ptyConnector: PtyConnector;
  private _ptyCounter = 0;
  private _ptyMap: Map<number, PtyTuple> = new Map<number, PtyTuple>();
  private _onPtyExitEventEmitter = new EventEmitter<number>();
  private _onPtyDataEventEmitter = new EventEmitter<PtyDataEvent>();
  private _onPtyAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<PtyAvailableWriteBufferSizeChangeEvent>();

  constructor(config: Config /* FIXME remove this param */, private _extensionManager: MainExtensionManager) {
    this._log = getLogger("PtyManager", this);
    this._ptyConnector = PtyConnectorFactory.factory(config);
    this.onPtyExit = this._onPtyExitEventEmitter.event;
    this.onPtyData = this._onPtyDataEventEmitter.event;
    this.onPtyAvailableWriteBufferSizeChange = this._onPtyAvailableWriteBufferSizeChangeEventEmitter.event;
  }
  
  @log
  getDefaultSessions(): SessionConfiguration[] {
    const results: SessionConfiguration[] = [];
    for (const backend of this._extensionManager.getSessionBackendContributions()) {

      const defaultSessions = backend.sessionBackend.defaultSessionConfigurations();
      for (const session of defaultSessions) {
        session.uuid = createUuid();
        results.push(session);
      }
    }

    return results;
  }

  setConfigDistributor(configDistributor: ConfigDistributor): void  {
    this._configDistributor = configDistributor;
  }
  
  dispose(): void {
    this._ptyConnector.destroy();
    this._ptyConnector = null;
  }

  onPtyExit: Event<number>;
  onPtyData: Event<PtyDataEvent>;
  onPtyAvailableWriteBufferSizeChange: Event<PtyAvailableWriteBufferSizeChangeEvent>;

  createPty(sessionUuid: string, file: string, args: string[], env: EnvironmentMap, cols: number, rows: number): number {
      
    const ptyEnv = _.clone(env);
    ptyEnv["TERM"] = 'xterm';
  
    const ptyTerm = this._ptyConnector.spawn(file, args, {
        name: 'xterm',
        cols: cols,
        rows: rows,
    //    cwd: process.env.HOME,
        env: ptyEnv } );
  
    this._ptyCounter++;
    const ptyId = this._ptyCounter;
    const ptyTup = { ptyTerm: ptyTerm, outputBufferSize: 0, outputPaused: true };
    this._ptyMap.set(ptyId, ptyTup);
    
    ptyTerm.onData( (data: string) => {
      if (LOG_FINE) {
        this._log.debug("pty process got data for ptyID=" + ptyId);
        this._logJSData(data);
      }

      this._onPtyDataEventEmitter.fire({ptyId, data});
    });
  
    ptyTerm.onExit( () => {
      if (LOG_FINE) {
        this._log.debug("pty process exited.");
      }

      this._onPtyExitEventEmitter.fire(ptyId);

      ptyTerm.destroy();
      this._ptyMap.delete(ptyId);
    });
  
    ptyTerm.onAvailableWriteBufferSizeChange( (bufferSizeChange: BufferSizeChange) => {
      this._onPtyAvailableWriteBufferSizeChangeEventEmitter.fire({ptyId, bufferSizeChange});
    });
  
    return ptyId;
  }

  ptyInput(ptyId: number, data: string): void {
    const ptyTerminalTuple = this._ptyMap.get(ptyId);
    if (ptyTerminalTuple === undefined) {
      this._log.debug("handlePtyInput() WARNING: Input arrived for a terminal which doesn't exist.");
      return;
    }
  
    ptyTerminalTuple.ptyTerm.write(data);
  } 

  ptyOutputBufferSize(ptyId: number, size: number): void {
    const ptyTerminalTuple = this._ptyMap.get(ptyId);
    if (ptyTerminalTuple === undefined) {
      this._log.debug("handlePtyOutputBufferSize() WARNING: Input arrived for a terminal which doesn't exist.");
      return;
    }
  
    if (LOG_FINE) {
      this._log.debug(`Received Output Buffer Size message. id: ${ptyId}, size: ${size}`);
    }
    ptyTerminalTuple.ptyTerm.permittedDataSize(size);
  }
  
  ptyResize(ptyId: number, columns: number, rows: number): void {
    const ptyTerminalTuple = this._ptyMap.get(ptyId);
    if (ptyTerminalTuple === undefined) {
      this._log.debug("handlePtyResize() WARNING: Input arrived for a terminal which doesn't exist.");
      return;
    }
    ptyTerminalTuple.ptyTerm.resize(columns, rows);
  }
  
  closePty(ptyId: number): void {
    const ptyTerminalTuple = this._ptyMap.get(ptyId);
    if (ptyTerminalTuple === undefined) {
      this._log.debug("handlePtyCloseRequest() WARNING: Input arrived for a terminal which doesn't exist.");
      return;
    }
    ptyTerminalTuple.ptyTerm.destroy();
    this._ptyMap.delete(ptyId);
  }
  
  private _logData(data: string): void {
    this._log.debug(substituteBadChars(data));
  }

  private _logJSData(data: string): void {
    this._log.debug(formatJSData(data));
  }
}

function mapBadChar(m: string): string {
  const c = m.charCodeAt(0);
  switch (c) {
    case 8:
      return "\\b";
    case 12:
      return "\\f";
    case 13:
      return "\\r";
    case 11:
      return "\\v";
    case 0x22:
      return '\\"';
    default:
      if (c <= 255) {
        return "\\x" + Util.to2DigitHex(c);
      } else {
        return "\\u" + Util.to2DigitHex( c >> 8) + Util.to2DigitHex(c & 0xff);
      }
  }
}

function substituteBadChars(data: string): string {
  return data.replace(/[^ /{},.:;<>!@#$%^&*()+=_'"a-zA-Z0-9-]/g, mapBadChar);
}

// Format a string as a series of JavaScript string literals.
function formatJSData(data: string, maxLen: number = 60): string {
  let buf = "";
  let result = "";
  for (let i=0; i<data.length; i++) {
    buf += substituteBadChars(data[i]);
    if (buf.length+6 >= maxLen) {
      result += "\"" + buf + "\"\n";
      buf = "";
    }
  }
  
  if (buf !== "") {
    result += "\"" + buf + "\"\n";
  }
  return result;
}
