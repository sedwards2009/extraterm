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
 * @param  {boolean} value the boolean to convert.
 * @return {string}        "true" or "false".
 */
export function booleanToString(value: boolean): string {
  return value ? "true" : "false";
}

export function createShadowRoot(self: HTMLElement): ShadowRoot {
    return self.webkitCreateShadowRoot ? self.webkitCreateShadowRoot() : self.createShadowRoot();
}
  
export function getShadowRoot(self: HTMLElement): ShadowRoot {
    return self.webkitShadowRoot ? self.webkitShadowRoot : self.shadowRoot;
}

export function trimRight(source: string): string {
  if (source === null) {
    return null;
  }
  return ("|"+source).trim().substr(1);
}

export function getShadowId(el: HTMLElement, id: string): HTMLElement {
  return <HTMLElement> getShadowRoot(el).querySelector('#' + id);
}

/**
 * Converts a node list to a real array.
 * 
 * @param  nodeList the node list to convert.
 * @return          a new array holding the same contents as the node list.
 */
export function nodeListToArray(nodeList: NodeList): Node[] {
  let i = 0;
  const result: Node[] = [];
  const len = nodeList.length;
  for (i=0; i<len; i++) {
    result.push(nodeList[i]);
  }
  return result;
}

//-------------------------------------------------------------------------
export interface LaterHandle {
  cancel(): void;
}

let doLaterId: number = -1;
let laterList: Function[] = [];

function doLaterTimeoutHandler(): void {
  doLaterId = -1;
  const workingList = [...laterList];
  laterList = [];
  workingList.forEach( f => f() );
}

/**
 * Schedule a function to be executed later.
 * 
 * @param  {Function}    func [description]
 * @return {LaterHandle} This object can be used to cancel the scheduled execution.
 */
export function doLater(func: Function): LaterHandle {
  laterList.push(func);
  if (doLaterId === -1) {
    doLaterId = window.setTimeout(doLaterTimeoutHandler, 0);
  }
  return { cancel: () => {
    laterList = laterList.filter( f => f!== func );
  } };
}

let doLaterFrameId: number = -1;
let laterFrameList: Function[] = [];

/**
 * Schedule a function to run at the next animation frame.
 */
function doLaterFrameHandler(): void {
  const workingList = [...laterFrameList];
  laterFrameList = [];
  
  window.cancelAnimationFrame(doLaterFrameId);
  doLaterFrameId = -1;
  
  workingList.forEach( f => f() );
}

export function doLaterFrame(func: Function): LaterHandle {
  laterFrameList.push(func);
  if (doLaterFrameId === -1) {
    doLaterFrameId = window.requestAnimationFrame(doLaterFrameHandler);
  }
  return { cancel: () => {
    laterFrameList = laterFrameList.filter( f => f!== func );
  } };
}

//-------------------------------------------------------------------------

/**
 * Parse a string as a boolean value
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
 * Returns the new value if is is available otherwise de default value.
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
 * Small class for handling CSS colors.
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

function to2DigitHex(value: number): string {
  const h = value.toString(16);
  return h.length === 1 ? "0" + h : h;
}
