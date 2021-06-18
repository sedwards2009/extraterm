/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Map a resource name to a URL.
 *
 * This particular mapping function works in a nodejs context.
 * 
 * @param resourceName relative path to the resource from the main src directory.
 * @return a URL which points to the resource.
 */
export function toUrl(resourceName: string): string {
  const mainPath = __dirname;
  return "file://" + mainPath.replace(/\\/g, "/") + "/" + resourceName;
}
