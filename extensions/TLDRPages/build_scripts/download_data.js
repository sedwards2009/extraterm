/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');

if ( ! test('-d', 'data')) {
  echo("Downloading TLDR Pages data files...");
  exec('download --extract --out data http://tldr-pages.github.io/assets/tldr.zip');
  rm('-r', 'data/pages.*');
  rm('data/index.json');
  echo("Done downloading TLDR Pages data.");
}
