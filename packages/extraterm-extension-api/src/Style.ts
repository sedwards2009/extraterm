/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Style {
  readonly htmlStyleTag: string;

  readonly dpi: number;

  emToPx(em: number): number;
}
