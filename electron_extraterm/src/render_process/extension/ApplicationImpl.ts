/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { shell } from "electron";
import { ClipboardImpl } from "./ClipboardImpl";

export class ApplicationImpl implements ExtensionApi.Application {

  #clipboard = new ClipboardImpl();
  #version = "";

  constructor(version: string) {
    this.#version = version;
  }

  get clipboard(): ExtensionApi.Clipboard {
    return this.#clipboard;
  }

  openExternal(url: string): void {
    shell.openExternal(url);
  }

  showItemInFileManager(path: string): void {
    shell.showItemInFolder(path);
  }

  get isLinux(): boolean {
    return process.platform === "linux";
  }

  get isMacOS(): boolean {
    return process.platform === "darwin";
  }

  get isWindows(): boolean {
    return process.platform === "win32";
  }

  get version(): string {
    return this.#version;
  }
}
