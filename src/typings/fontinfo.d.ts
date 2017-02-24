/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

declare var fontinfo: fontinfo.Parse;
export = fontinfo;

declare namespace fontinfo {
  
  interface NameInfo {
    copyright: string;
    fontFamily: string;
    fontSubFamily: string;
    fontIdentifier: string;
    fontName: string;
    fontVersion: string;
    postscriptName: string;
    manufacturer: string;
    vendorURL: string;
    license: string;
    licenseURL: string;
  }
  
  interface PostInfo {
    format: number;
    italicAngle: number;
    underlinePosition: number;
    underlineThickness: number;
    isFixedPitch: number;
  }
  
  interface FontInfo {
    name: NameInfo;
    post: PostInfo;
  }

  interface Parse {
    (filename: string): FontInfo;
  }

}
