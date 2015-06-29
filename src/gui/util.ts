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
