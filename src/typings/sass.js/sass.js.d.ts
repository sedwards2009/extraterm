// Type definitions for sass.js
// Project: https://github.com/medialize/sass.js

// Definitions by: Simon Edwards <simon@simonzone.com>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

// This is for the synchronous node API.

declare module "sass.js" {
  
    interface ImporterRequest {
      current: string;
      path: string;
      previous: string;
      resolved: string;
    }
  
    interface ImporterDone {
      content?: string;
      path?: string;
      error?: string;
    }
  
    interface Importer {
        (request: ImporterRequest, done: (data?: ImporterDone) => void): void;
    }

    interface Options {
      // style: 
      comments?: boolean;
      indentedSyntax?: boolean;
      indent?: string;
      linefeed?: string;
      precision?: number;
      sourceMapFile?: string;
      sourceMapRoot?: string;
      inputPath?: string;
      outputPath?: string;
      sourceMapContents?: boolean;
      sourceMapEmbed?: boolean;
      sourceMapOmitUlr?: boolean;
    }

    interface SuccessResult {
      status: number;
      text: string;
      map: any;
      files: string[];
    }
    
    interface ErrorResult {
      status: number;
      file: string;
      line: number;
      column: number
      message: string;
      formatted: string;
    }

    export function compile(text: string, callback: (result: SuccessResult | ErrorResult) => void): void;
    export function compile(text: string, options: Options, callback: (result: SuccessResult | ErrorResult) => void): void;
    export function compileFile(filename: string, callback: (result: SuccessResult | ErrorResult) => void): void;
    export function compileFile(filename: string, options: Options, callback: (result: SuccessResult | ErrorResult) => void): void;
    export function importer(importerFunc: Importer): void;
}
