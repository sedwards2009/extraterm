/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EtTerminal} from '../Terminal';

// This is a way of passing through all of the state which is common across all extension contexts.

export interface CommonExtensionState {
  activeTerminal: EtTerminal;
}
