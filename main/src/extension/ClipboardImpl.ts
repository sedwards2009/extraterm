/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { QApplication } from '@nodegui/nodegui';


export class ClipboardImpl implements ExtensionApi.Clipboard {
  writeText(text: string): void {
    const clipboard = QApplication.clipboard();
    clipboard.setText(text);
  }
}
