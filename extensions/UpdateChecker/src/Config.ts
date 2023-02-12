/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type CheckFrequency = 'never' | 'daily' | 'weekly';

export interface Config {
  frequency: CheckFrequency;
  lastCheck: number;
  newVersion: string;
  newUrl: string;
}
