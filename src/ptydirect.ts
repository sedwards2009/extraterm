
import * as pty from 'pty.js';
import {PtyConnector as PtyConnector, Pty as Pty, PtyOptions as PtyOptions} from './ptyconnector';
import configInterfaces = require('./config');
type Config = configInterfaces.Config;

class DirectPty implements Pty {
  
  private realPty: pty.Terminal;
    
  constructor(file?: string, args?: string[], opt?: PtyOptions) {
    this.realPty = pty.createTerminal(file, args, opt);
  }
  
  write(data: any): void {
    this.realPty.write(data);
  }
  
  resize(cols: number, rows: number): void {
    this.realPty.resize(cols, rows);
  }
  
  onData(callback: (data: any) => void): void {
    this.realPty.on('data', callback);
  }
  
  onExit(callback: () => void): void {
    this.realPty.on('exit', callback);
  }
  
  destroy(): void {
    this.realPty.destroy();
  }
}

function spawn(file: string, args: string[], opt: PtyOptions): Pty {
  return new DirectPty(file, args, opt);
}

export function factory(config: Config): PtyConnector {
  return {
    spawn: spawn,
    destroy() {}
  };
}
