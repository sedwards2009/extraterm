/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

 export interface ExtensionMetadata {
  name: string;
  path: string;
  main: string;
  version?: string;
  description?: string;
  module: any;
  contributions: ExtensionContributions;
}

export interface ExtensionContributions {
  viewer: ExtensionViewerContribution[];
}

export interface ExtensionViewerContribution {
  name: string;
  mimeTypes: string[];
}
