/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import ThemeTypes = require('./theme');

/**
 * Module for handling the distribution of newly computed CSS themes to all
 * elements which need them. This is the render process based counter-part
 * to the ThemeManager. It receives the updated CSS from ThemeManager in the
 * main process.
 */

// Our simple registry of instances to update.
const themeableRegistry = new Set<ThemeTypes.Themeable>();

// Last known CssFile map.
let currentCssMap = new Map<ThemeTypes.CssFile, string>();
ThemeTypes.cssFileEnumItems.forEach( (cssFile) => {
  currentCssMap.set(cssFile, "");
});

/**
 * Register a `Themeable` instance for updates.
 *
 * @param themeable the instance which requires theme CSS updates
 */
export function registerThemeable(themeable: ThemeTypes.Themeable): void {
  themeableRegistry.add(themeable);
}

/**
 * Unregister a `Themeable` instance.
 *
 * This method should be called to unregister a themeable instance before
 * it is destroyed. Failing to unregister may result in a memory leak.
 *
 * @param themeable the instance to unregister
 */
export function unregisterThemeable(themeable: ThemeTypes.Themeable): void {
  themeableRegistry.delete(themeable);
}

/**
 * Updates the CSS used by all Themeable instances with newly computed CSS.
 *
 * @param cssMap the map of CssFiles to their matching CSS texts
 */
export function updateCss(cssMap: Map<ThemeTypes.CssFile, string>): void {
  const newCssMap = new Map(currentCssMap);
  cssMap.forEach( (value, key) => newCssMap.set(key, value));
  currentCssMap = newCssMap;
  themeableRegistry.forEach( (themeable) => themeable.setThemeCssMap(newCssMap) );
}

/**
 * Gets the map of CssFiles to their CSS texts.
 * 
 * @returns the map
 */
export function cssMap(): Map<ThemeTypes.CssFile, string> {
  return currentCssMap;
}
