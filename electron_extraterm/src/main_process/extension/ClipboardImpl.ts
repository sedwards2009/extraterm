/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { clipboard } from "electron";

import * as ExtensionApi from '@extraterm/extraterm-extension-api';


export class ClipboardImpl implements ExtensionApi.Clipboard {
  writeText(text: string): void {
    clipboard.writeText(text);
  }
}
