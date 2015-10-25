
declare module CodeMirror {
  interface Editor {
    on(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: number, event: KeyboardEvent) => void ): void;
    off(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: number, event: KeyboardEvent) => void ): void;
    
    on(eventName: 'keydown', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    on(eventName: 'keyup', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    on(eventName: 'keypress', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keydown', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keyup', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keypress', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    
    on(eventName: 'scrollCursorIntoView', handle: (instance:  CodeMirror.Editor, event: Event) => void ): void;
    off(eventName: 'scrollCursorIntoView', handle: (instance:  CodeMirror.Editor, event: Event) => void ): void;
  }
  
  interface EditorConfiguration {
    scrollbarStyle?: string;
    cursorScrollMargin?: number;
  }
  
  interface Doc {
    getSelection(linesep: string): string;
  }
}
