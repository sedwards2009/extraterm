/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { ExtensionMetadata } from "../../../ExtensionMetadata";

export interface ExtensionMetadataAndState {
  metadata: ExtensionMetadata;
  running: boolean;
}
