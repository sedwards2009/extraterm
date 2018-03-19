/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import stream = require('stream');

declare function getUri(uri: string, callback: (err, rs: stream.Readable) => void): void;
export = getUri;
