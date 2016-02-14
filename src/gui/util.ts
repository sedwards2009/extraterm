/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Convert a value to a boolean.
 * 
 * @param {Object} value The value to parse and convert.
 * @param {Boolean} defaultValue (Optional) The default value if the input
 *     was too ambigious. Defaults to false.
 * @returns {Boolean} The converted value.
 */
export function htmlValueToBool(value: any, defaultValue?: boolean): boolean {
  if (value === null || value === undefined || value === "") {
    return defaultValue === undefined ? false : defaultValue;
  }
  return ! (value === false || value === "false");
}

/**
 * Converts a boolean to a string.
 * 
 * @param  value the boolean to convert
 * @return the string "true" or "false"
 */
export function booleanToString(value: boolean): string {
  return value ? "true" : "false";
}

/**
 * Trim whitlespace on the right side of a string.
 *
 * @param source the string to trim
 * @return the trimmed string
 */
export function trimRight(source: string): string {
  if (source === null) {
    return null;
  }
  return ("|"+source).trim().substr(1);
}

const nbspRegexp = /\u00a0/g;
/**
 * Replace non-breaking space characters with normal spaces.
 * 
 * @param  text the string to replace the characters in
 * @return new string with new-breaking spaces removed
 */
export function replaceNbsp(text: string): string {
  return text.replace(nbspRegexp, " ");
}

//-------------------------------------------------------------------------

/**
 * Parse a string as a boolean value.
 * 
 * @param  value string to parse
 * @return the boolean value or false if it could not be parsed
 */
export function toBoolean(value: any): boolean {
  if (value === true || value === false) {
    return value;
  }
  if (value === 0) {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return Boolean(value);
}

/**
 * Returns the new value if is is available otherwise the default value.
 *
 * @param defaultValue
 * @param newValue
 * @return Either the default value or the new value.
 */
export function override(defaultValue: any, newValue: any): any {
  return newValue !== null && newValue !== undefined ? newValue : defaultValue;
}

//-------------------------------------------------------------------------
/**
 * Utility class for handling CSS colors
 */
export class Color {
  
  _red: number;
  _green: number;
  _blue: number;
  _opacity: number;
  _hexString: string = null;
  _rgbaString: string = null;
  
  /**
   * Creates a color object.
   * 
   * @param  {string |       number}      redOrString [description]
   * @param  {number}    green   [description]
   * @param  {number}    blue    [description]
   * @param  {number}    opacity [description]
   * @return {[type]}            [description]
   */
  constructor(redOrString: string | number, green?: number, blue?: number, opacity?: number) {
    if (typeof redOrString === "string") {
      const stringColor = <string> redOrString;
      if (stringColor.startsWith("#")) {
        if (stringColor.length === 4) {
          // Parse the 4bit colour values and expand then to 8bit.
          this._red = parseInt(stringColor.slice(1,2), 16) * 17;
          this._green = parseInt(stringColor.slice(2,3), 16) * 17;
          this._blue = parseInt(stringColor.slice(3,4), 16) * 17;
          
        } else if (stringColor.length === 7) {
          this._red = parseInt(stringColor.slice(1,3), 16);
          this._green = parseInt(stringColor.slice(3,5), 16);
          this._blue = parseInt(stringColor.slice(5,7), 16);          
        } else {
          // Malformed hex colour.
          
        }
        this._opacity = 1;
        
      } else {
        // What now?!
      }
    } else {
      // Assume numbers.
      const red = <number> redOrString;
      this._red = red;
      this._green = green !== undefined ? green : 0;
      this._blue = blue !== undefined ? blue : 0;
      this._opacity = opacity !== undefined ? opacity : 1;
    }
  }
  /**
   * Returns the color as a 6 digit hex string.
   * 
   * @return the color as a CSS style hex string.
   */
  toHexString(): string {
    if (this._hexString === null) {
      this._hexString = "#" + to2DigitHex(this._red) + to2DigitHex(this._green) + to2DigitHex(this._blue);
    }
    return this._hexString;
  }  
  
  /**
   * Returns the color as a CSS rgba() value.
   * 
   * @return the color as a CSS rgba() value.
   */
  toRGBAString(): string {
    if (this._rgbaString === null) {
      this._rgbaString = "rgba(" + this._red + "," + this._green + "," + this._blue + "," + this._opacity + ")";
    }
    return this._rgbaString;
  }
  
  /**
   * Returns the color as a CSS string.
   * 
   * @return the color as a CSS formatted string.
   */
  toString(): string {
    if (this._opacity == 1) {
      // Use a hex representation.
      return this.toHexString();
    } else {
      return this.toRGBAString();
    }
  }

  /**
   * Creates a new color with the given opacity value.
   * 
   * @param  newOpacity A number from 0 to 1.
   * @return the new color.
   */
  opacity(newOpacity: number): Color {
    return new Color(this._red, this._green, this._blue, newOpacity);
  }
}

/**
 * Converts an 8bit number to a 2 digit hexadecimal string.
 * 
 * @param  {number} value An integer in the range 0-255 inclusive.
 * @return {string}       the converted number.
 */
export function to2DigitHex(value: number): string {
  const h = value.toString(16);
  return h.length === 1 ? "0" + h : h;
}
