/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/*
 * This little utility can be run from the command line using node. It lets you view the metadata of all of the
 * themes in the src/themes directory, and it can compile a theme into CSS and report any errors.
 */
import * as path from 'path';
import * as fs from 'fs';
import {ThemeManager, ThemeTypePaths, RenderResult} from './ThemeManager';
import * as ThemeTypes from './Theme';
import * as SourceDir from '../SourceDir';
import * as Commander from 'commander';
import {MainExtensionManager} from '../main_process/extension/MainExtensionManager';

import {Logger, getLogger} from "extraterm-logging";
import { cssFileToFilename } from './Theme';

const print = console.log.bind(console);


interface CommandLineOptions {
  list?: boolean;
  compile?: string;
  output?: string;
  all?: boolean
}


class ThemeManagerUtility {

  private _tm: ThemeManager;

  async main(): Promise<void> {
    const options = this._parseArgs();

    const paths: ThemeTypePaths = {
      css: [path.join(SourceDir.path, '../resources/themes')],
      syntax: [],
      terminal: []
    };
    this._tm = new ThemeManager(paths, new MainExtensionManager(null, []));

    if (options.list) {
      this._listThemes();
    } else {
      if (options.all) {
        return this._renderAll(options.output);
      } else {
        return this._renderAndOutputOneTheme(options.compile, options.output);
      }
    }
  }

  private _parseArgs(): CommandLineOptions {
    Commander
      .option('-l, --list', 'List all available themes.')
      .option('-a, --all', 'Compile all themes.')
      .option('-c, --compile [theme_id]', 'Compile a theme and write it to stdout.')
      .option('-o, --output [directory]', 'Write compiled theme files to this directory instead of stdout.')
      .parse(process.argv);
    return <CommandLineOptions> Commander;
  }

  private _listThemes(): void {
    // List the theme metadata.
    const allThemes = this._tm.getAllThemes();
    print(allThemes);
  }

  private async _renderTheme(themeInfo: ThemeTypes.ThemeInfo): Promise<RenderResult> {
    const globalVariables = new Map<string, number|boolean|string>();
    globalVariables.set("extraterm-platform", process.platform);
    globalVariables.set("extraterm-titlebar-visible", false);

    return this._tm.renderGui(themeInfo.id, null, globalVariables);
  }

  private async _renderAndOutputOneTheme(themeId: string, outputDir: string): Promise<void> {
    const allThemes = this._tm.getAllThemes();
    const themes = allThemes.filter( (themeInfo) => themeInfo.id === themeId);
    if (themes.length === 0) {
      print(`Unable to find theme with ID '${themeId}'.`);
      process.exit(1);
    }

    for (const themeInfo of themes) {
      if (outputDir != null) {
        this._makeDirIfMissing(outputDir);
      }

      const contents = await this._renderTheme(themeInfo);
      if ( ! contents.success) {
        print(contents.errorMessage);
        continue;
      }
      this._writeThemeCss(contents, outputDir);
    }
  }

  private _makeDirIfMissing(dir: string): void {
    try {
      fs.accessSync(dir, fs.constants.F_OK);
    } catch(err) {
      print(`Creating directory '${dir}'`);
      fs.mkdirSync(dir);
    }
  }

  private _writeThemeCss(contents: RenderResult, outputDir: string): void {
    contents.themeContents.cssFiles.forEach( item => {
      if (outputDir != null) {
        const cssFilename = cssFileToFilename(item.cssFileName).slice(0, -5) + ".css";

        const filenameParts = path.parse(cssFilename);
        if (filenameParts.dir != null && filenameParts.dir !== "") {
          this._makeDirIfMissing(path.join(outputDir, filenameParts.dir));
        }

        const output = path.join(outputDir, cssFilename);
        print(`Writing ${output}`);
        fs.writeFileSync(output, item.contents);

      } else {
        print("/* SCSS " + cssFileToFilename(item.cssFileName) + " */");
        print(item.contents);
      }
    });
  }

  private async _renderAll(outputDir: string): Promise<void> {
    this._makeDirIfMissing(outputDir);

    const allThemes = this._tm.getAllThemes();
    for (const themeInfo of allThemes) {
      if (themeInfo.type === "gui") {
        const themeOutputDir = path.join(outputDir, themeInfo.id);
        this._makeDirIfMissing(themeOutputDir);
        const contents = await this._renderTheme(themeInfo);
        if ( ! contents.success) {
          print(contents.errorMessage);
          continue;
        }

        this._writeThemeCss(contents, themeOutputDir);
      }
    }
  }
}

new ThemeManagerUtility().main();

