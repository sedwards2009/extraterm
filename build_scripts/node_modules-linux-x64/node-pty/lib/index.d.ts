import { ITerminal, IPtyOpenOptions, IPtyForkOptions } from './interfaces';
import { ArgvOrCommandLine } from './types';
/**
 * Forks a process as a pseudoterminal.
 * @param file The file to launch.
 * @param args The file's arguments as argv (string[]) or in a pre-escaped
 * CommandLine format (string). Note that the CommandLine option is only
 * available on Windows and is expected to be escaped properly.
 * @param options The options of the terminal.
 * @see CommandLineToArgvW https://msdn.microsoft.com/en-us/library/windows/desktop/bb776391(v=vs.85).aspx
 * @see Parsing C++ Comamnd-Line Arguments https://msdn.microsoft.com/en-us/library/17w5ykft.aspx
 * @see GetCommandLine https://msdn.microsoft.com/en-us/library/windows/desktop/ms683156.aspx
 */
export declare function spawn(file?: string, args?: ArgvOrCommandLine, opt?: IPtyForkOptions): ITerminal;
/** @deprecated */
export declare function fork(file?: string, args?: ArgvOrCommandLine, opt?: IPtyForkOptions): ITerminal;
/** @deprecated */
export declare function createTerminal(file?: string, args?: ArgvOrCommandLine, opt?: IPtyForkOptions): ITerminal;
export declare function open(options: IPtyOpenOptions): ITerminal;
/**
 * Expose the native API when not Windows, note that this is not public API and
 * could be removed at any time.
 */
export declare const native: any;
