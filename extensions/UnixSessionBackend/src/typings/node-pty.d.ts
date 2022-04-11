/**
 * Copyright (c) 2019, Simon Edwards <simon@simonzome.com>
 */
import * as net from 'node:net';

/**
 * This exposes additional properties of the node-pty implementation.
 */
declare module 'node-pty' {

  export interface IPty {
    on(event: 'drain', listener: () => void): void;

    pause(): void;
    resume(): void;
    destroy(): void;
    _socket: net.Socket;
  }
}
