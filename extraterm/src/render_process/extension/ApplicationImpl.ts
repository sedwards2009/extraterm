/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { shell } from "electron";
import { ClipboardImpl } from "./ClipboardImpl";

export class ApplicationImpl implements ExtensionApi.Application {

  clipboard = new ClipboardImpl();

  openExternal(url: string): void {
    shell.openExternal(url);
  }
}
