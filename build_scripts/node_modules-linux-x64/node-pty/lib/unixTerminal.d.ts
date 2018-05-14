/// <reference types="node" />
/**
 * Copyright (c) 2012-2015, Christopher Jeffrey (MIT License)
 * Copyright (c) 2016, Daniel Imms (MIT License).
 */
import * as net from 'net';
import { Terminal } from './terminal';
import { IPtyForkOptions, IPtyOpenOptions } from './interfaces';
import { ArgvOrCommandLine } from './types';
export declare class UnixTerminal extends Terminal {
    protected _fd: number;
    protected _pty: string;
    protected _file: string;
    protected _name: string;
    protected _readable: boolean;
    protected _writable: boolean;
    private _boundClose;
    private _emittedClose;
    private _master;
    private _slave;
    readonly master: net.Socket;
    readonly slave: net.Socket;
    constructor(file?: string, args?: ArgvOrCommandLine, opt?: IPtyForkOptions);
    /**
     * openpty
     */
    static open(opt: IPtyOpenOptions): UnixTerminal;
    write(data: string): void;
    destroy(): void;
    kill(signal?: string): void;
    /**
     * Gets the name of the process.
     */
    readonly process: string;
    /**
     * TTY
     */
    resize(cols: number, rows: number): void;
    private _sanitizeEnv(env);
}
