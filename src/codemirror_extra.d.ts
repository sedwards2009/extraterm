/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

declare module CodeMirror {
  interface Editor {
    on(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: string, event: KeyboardEvent) => void ): void;
    off(eventName: 'keyHandled', handler: (instance: CodeMirror.Editor, name: string, event: KeyboardEvent) => void ): void;
    
    on(eventName: 'keydown', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    on(eventName: 'keyup', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    on(eventName: 'keypress', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keydown', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keyup', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    off(eventName: 'keypress', handler: (instance: CodeMirror.Editor, event: KeyboardEvent) => void ): void;
    
    on(eventName: 'scrollCursorIntoView', handle: (instance:  CodeMirror.Editor, event: Event) => void ): void;
    off(eventName: 'scrollCursorIntoView', handle: (instance:  CodeMirror.Editor, event: Event) => void ): void;
    
    execCommand(command: string): void;
  }
  
  interface EditorConfiguration {
    scrollbarStyle?: string;
    cursorScrollMargin?: number;
  }
  
  interface Doc {
    getSelection(linesep?: string): string;
    getSelections(linesep?: string): string[];
    setSelections(ranges: {anchor: CodeMirror.Position, head: CodeMirror.Position}[], primary?: number, options?: Object);
    replaceSelections(replacements: string[], select?: 'around' | 'start');
  }
  
  interface ModeInfo {
    name: string;
    mime?: string;
    mimes?: string[];
    mode?: string;
    ext?: string[];
    alias?: string[];
  }
  
  interface TextMarker {
    className: string;
  }
  
  function findModeByMIME(mime: string): ModeInfo;
  function findModeByExtension(ext: string): ModeInfo;
  function findModeByFileName(fileName: string): ModeInfo;
  function findModeByName(name: string): ModeInfo;
  var commands: Object;
}
