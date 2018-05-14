/// <reference types="node" />
import { Socket } from 'net';
import { Terminal } from './terminal';
import { IPtyForkOptions, IPtyOpenOptions } from './interfaces';
import { ArgvOrCommandLine } from './types';
export declare class WindowsTerminal extends Terminal {
    private _isReady;
    private _deferreds;
    private _agent;
    constructor(file?: string, args?: ArgvOrCommandLine, opt?: IPtyForkOptions);
    /**
     * openpty
     */
    static open(options?: IPtyOpenOptions): void;
    /**
     * Events
     */
    write(data: string): void;
    /**
     * TTY
     */
    resize(cols: number, rows: number): void;
    destroy(): void;
    kill(signal?: string): void;
    private _defer(deferredFn);
    readonly process: string;
    readonly master: Socket;
    readonly slave: Socket;
}
