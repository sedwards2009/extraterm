/// <reference types="node" />
import { Socket } from 'net';
import { ArgvOrCommandLine } from './types';
/**
 * Agent. Internal class.
 *
 * Everytime a new pseudo terminal is created it is contained
 * within agent.exe. When this process is started there are two
 * available named pipes (control and data socket).
 */
export declare class WindowsPtyAgent {
    private _inSocket;
    private _outSocket;
    private _pid;
    private _innerPid;
    private _innerPidHandle;
    private _fd;
    private _pty;
    readonly inSocket: Socket;
    readonly outSocket: Socket;
    readonly fd: any;
    readonly innerPid: number;
    readonly pty: number;
    constructor(file: string, args: ArgvOrCommandLine, env: string[], cwd: string, cols: number, rows: number, debug: boolean);
    resize(cols: number, rows: number): void;
    kill(): void;
    getExitCode(): number;
}
export declare function argsToCommandLine(file: string, args: ArgvOrCommandLine): string;
