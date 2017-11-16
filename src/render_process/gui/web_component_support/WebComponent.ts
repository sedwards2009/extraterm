/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface WebComponentOptions {
  // The tag name to register this component under. This must conform to the
  // requirements set down in the Custom Element spec and contain a hyphen.
  tag: string;
}

/**
 * Class decorator for web components.
 * 
 * This should appear at the top of classes which implement Custom Elements.
 */
export function WebComponent(options: WebComponentOptions): (target: any) => any {
  return function(target: any): any {
    window.customElements.define(options.tag.toLowerCase(), target);
    return target;
  };
}
