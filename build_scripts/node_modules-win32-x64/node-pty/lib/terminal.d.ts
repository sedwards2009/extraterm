/// <reference types="node" />
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { ITerminal, IPtyForkOptions } from './interfaces';
export declare const DEFAULT_COLS: number;
export declare const DEFAULT_ROWS: number;
export declare abstract class Terminal implements ITerminal {
    protected _socket: Socket;
    protected _pid: number;
    protected _fd: number;
    protected _pty: any;
    protected _file: string;
    protected _name: string;
    protected _cols: number;
    protected _rows: number;
    protected _readable: boolean;
    protected _writable: boolean;
    protected _internalee: EventEmitter;
    readonly pid: number;
    constructor(opt?: IPtyForkOptions);
    private _checkType(name, value, type);
    /** See net.Socket.end */
    end(data: string): void;
    /** See stream.Readable.pipe */
    pipe(dest: any, options: any): any;
    /** See net.Socket.pause */
    pause(): Socket;
    /** See net.Socket.resume */
    resume(): Socket;
    /** See net.Socket.setEncoding */
    setEncoding(encoding: string): void;
    addListener(eventName: string, listener: (...args: any[]) => any): void;
    on(eventName: string, listener: (...args: any[]) => any): void;
    emit(eventName: string, ...args: any[]): any;
    listeners(eventName: string): Function[];
    removeListener(eventName: string, listener: (...args: any[]) => any): void;
    removeAllListeners(eventName: string): void;
    once(eventName: string, listener: (...args: any[]) => any): void;
    abstract write(data: string): void;
    abstract resize(cols: number, rows: number): void;
    abstract destroy(): void;
    abstract kill(signal?: string): void;
    readonly abstract process: string;
    readonly abstract master: Socket;
    readonly abstract slave: Socket;
    redraw(): void;
    protected _close(): void;
    protected _parseEnv(env: {
        [key: string]: string;
    }): string[];
}
