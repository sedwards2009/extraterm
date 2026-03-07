/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';

if ( ! sh.test('-d', 'data')) {
  sh.echo("Downloading TLDR Pages data files...");
  sh.exec('download --extract --out data https://github.com/tldr-pages/tldr/releases/latest/download/tldr.zip');
  sh.rm('-r', 'data/pages.*');
  sh.mv('data/index.json', 'data/pages/index.json');
  sh.echo("Done downloading TLDR Pages data.");
}
