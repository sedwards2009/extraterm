/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';

import {Pty, BufferSizeChange} from '../pty/Pty';
import {EventEmitter} from '../utils/EventEmitter';
import {Logger, getLogger} from '../logging/Logger';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';

/**
 * Exposes PTY objects in the render process which are backed by corresponding
 * PTY objects in the main process. It bridges the IPC mechanism.
 */
export class PtyIpcBridge {

  private _log: Logger;
  private _idToPtyImplMap = new Map<number, PtyImpl>();

  constructor() {
    this._log = getLogger("PtyIpcBridge", this);

    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_OUTPUT, this._handlePtyOutput.bind(this));
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_INPUT_BUFFER_SIZE_CHANGE,
      this._handlePtyInputBufferSizeChange.bind(this));
    WebIpc.registerDefaultHandler(Messages.MessageType.PTY_CLOSE, this._handlePtyClose.bind(this));
  }

  createPtyForTerminal(command: string, sessionArguments: string[], newEnv: any, columns: number, rows: number): Pty {
    const ptyImpl = new PtyImpl();
    ptyImpl.resize(columns, rows);

    WebIpc.requestPtyCreate(command, sessionArguments, columns, rows, newEnv)
    .then( (msg: Messages.CreatedPtyMessage) => {
      ptyImpl._ptyId = msg.id;

      this._idToPtyImplMap.set(msg.id, ptyImpl);
      ptyImpl._resendSize();
      
      // Just big enough to get things started. We don't need the exact buffer size.
      WebIpc.ptyOutputBufferSize(msg.id, 1024);
    });

    ptyImpl._onWillDestroy(() => {
      if (ptyImpl._ptyId != null) {
        this._idToPtyImplMap.delete(ptyImpl._ptyId);
      }
    });

    return ptyImpl;
  }

  private _handlePtyOutput(msg: Messages.PtyOutput): void {
    const ptyImpl = this._idToPtyImplMap.get(msg.id);
    if (ptyImpl == null) {
      this._log.warn(`Unable to find a PtyImpl object to match pty ID ${msg.id}`);
      return;
    }

    ptyImpl._processPtyOutput(msg.data);
  }

  private _handlePtyInputBufferSizeChange(msg: Messages.PtyInputBufferSizeChange): void {
    const ptyImpl = this._idToPtyImplMap.get(msg.id);
    if (ptyImpl == null) {
      this._log.warn(`Unable to find a PtyImpl object to match pty ID ${msg.id}`);
      return;
    }

    ptyImpl._processInputBufferSizeChange(msg.totalBufferSize, msg.availableDelta);
  }

  private _handlePtyClose(msg: Messages.PtyClose): void {
    const ptyImpl = this._idToPtyImplMap.get(msg.id);
    if (ptyImpl == null) {
      this._log.warn(`Unable to find a PtyImpl object to match pty ID ${msg.id}`);
      return;
    }

    ptyImpl._processExit();
  }
}


class PtyImpl implements Pty {
  
  _ptyId: number = null;
  private _onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  private _onDataEventEmitter = new EventEmitter<string>();
  private _onExitEventEmitter = new EventEmitter<void>();
  private _onWillDestroyEventEmitter = new EventEmitter<void>();

  private _columns = 80;
  private _rows = 24;

  constructor() {
    this.onAvailableWriteBufferSizeChange = this._onAvailableWriteBufferSizeChangeEventEmitter.event;
    this.onData = this._onDataEventEmitter.event;
    this.onExit = this._onExitEventEmitter.event;
    this._onWillDestroy = this._onWillDestroyEventEmitter.event;
  }

  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;
  onData: Event<string>;
  onExit: Event<void>;

  _onWillDestroy: Event<void>;

  write(data: string): void {
    if (this._ptyId != null) {
      WebIpc.ptyInput(this._ptyId, data);
    }
  }

  _processPtyOutput(data: string): void {
    this._onDataEventEmitter.fire(data);
  }

  _processInputBufferSizeChange(totalBufferSize: number, availableDelta: number): void {
    this._onAvailableWriteBufferSizeChangeEventEmitter.fire({totalBufferSize, availableDelta});
  }

  _processExit(): void {
    this._onExitEventEmitter.fire(undefined);
  }

  resize(columns: number, rows: number): void {
    this._columns = columns;
    this._rows = rows;
    if (this._ptyId != null) {
      WebIpc.ptyResize(this._ptyId, columns, rows);
    }
  }

  _resendSize(): void {
    if (this._ptyId != null) {
      WebIpc.ptyResize(this._ptyId, this._columns, this._rows);
    }
  }

  permittedDataSize(size: number): void {
    if (this._ptyId != null) {
      WebIpc.ptyOutputBufferSize(this._ptyId, size);
    }
  }

  destroy(): void {
    this._onWillDestroyEventEmitter.fire(undefined);
    if (this._ptyId != null) {
      WebIpc.ptyClose(this._ptyId);
    }
  }
}
