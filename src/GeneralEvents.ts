/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import viewerelementtypes = require('./viewerelementtypes');

export const EVENT_TYPE_TEXT = 'type-text';

export interface TypeTextEventDetail {
  text: string;
}

export const EVENT_SET_MODE = 'set-mode';
export interface SetModeEventDetail {
  mode: viewerelementtypes.Mode;
}
