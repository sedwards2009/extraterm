declare module "term.js" {
  export interface EventEmitter {
    addListener(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    once(event: string, listener: Function): EventEmitter;
    removeListener(event: string, listener: Function): EventEmitter;
    removeAllListeners(event?: string): EventEmitter;
    setMaxListeners(n: number): void;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
  }
  
  export class Terminal implements EventEmitter {
    constructor(options: any);
    static colors: string[];

    open(parentElement: HTMLElement): void;
    destroy(): void;
    setCursorBlink(blink: boolean): void;
    resizeToContainer(): { cols: number; rows: number; };
    write(m: string): void;
    keyPress(ev: KeyboardEvent): void;
    keyDown(ev: KeyboardEvent): void;
    scrollToBottom(): void;
    element: HTMLElement;
    appendElement(ev: HTMLElement): void;
    isScrollAtBottom(): boolean;
    _lineToHTML(line: any[]): string;
    debug: boolean;
    focus(): void;
    
    // EventEmitter.
    addListener(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    once(event: string, listener: Function): EventEmitter;
    removeListener(event: string, listener: Function): EventEmitter;
    removeAllListeners(event?: string): EventEmitter;
    setMaxListeners(n: number): void;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
  }
  
  export interface ScrollDetail {
    position: number;
    isBottom: boolean;
  }
}
