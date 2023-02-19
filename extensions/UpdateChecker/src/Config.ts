/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Config {
  checkOn: boolean;
  requestedPermission: boolean;
  lastCheck: number;
  newVersion: string;
  newUrl: string;
  lastDismissedVersion: string;
}
