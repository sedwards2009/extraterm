/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { Disposable, BlockMetadata } from "@extraterm/extraterm-extension-api";
import { Event } from "extraterm-event-emitter";
import { BulkFile } from "../bulk_file_handling/BulkFile.js";


export interface Block extends Disposable {
  getWidget(): QWidget;
  getMetadata(): BlockMetadata;
  onMetadataChanged: Event<void>;
  getBulkFile(): BulkFile;
  setParent(parent: any): void;
  getParent(): any;
}
