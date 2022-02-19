/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ClipboardImpl } from "./ClipboardImpl";
import * as open from "open";
import * as fs from "fs";
import * as path from "path";


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
    if (url == null) {
      return;
    }
    open(url);
  }

  showItemInFileManager(itemPath: string): void {
    if (itemPath == null) {
      return;
    }

    const stats = fs.statSync(itemPath);
    let cleanPath = itemPath;
    if (stats.isDirectory()) {
      cleanPath = path.dirname(itemPath);
    }
    open(`file:/${cleanPath}`);
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
