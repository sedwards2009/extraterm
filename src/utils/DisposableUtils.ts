/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Disposable} from 'extraterm-extension-api';

/**
 * Type guard to detecting objects which support the Disposable interface.
 */
export function isDisposable(it: any): it is Disposable {
  return 'dispose' in it;
}
