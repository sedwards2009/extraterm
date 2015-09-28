
declare module CodeMirror {
  interface Editor {
    on(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: number, event: KeyboardEvent) => void ): void;
    off(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: number, event: KeyboardEvent) => void ): void;
  }
  
  interface EditorConfiguration {
    scrollbarStyle?: string;
    cursorScrollMargin?: number;
  }
}
