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


type FilterMethod = (target: string, value: any) => any;
type ObserverMethod = (target: string) => void;

interface AttributeMetadata {
  name: string;
  directSetter: (newValue: any) => void;
  attributeName: string;
  filters: FilterMethod[];
  observers: ObserverMethod[];
}

interface AttributeMetadataMapping {
  [key: string]: AttributeMetadata;
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}

/**
 * Class decorator for web components.
 * 
 * This should appear at the top of classes which implement Custom Elements.
 */
export function WebComponent(options: WebComponentOptions): (target: any) => any {
  return function(constructor: any): any {

    if (constructor.hasOwnProperty("_attributes_")) {
      // Set up `observedAttributes` and `attributeChangedCallback()`
      Object.defineProperty(constructor, "observedAttributes", {
        get: function() {
          return Object.keys(constructor._attributes_);
        },
        enumerable: true,
        configurable: true
      });

      let originalAttributeChangedCallback = null;
      if (constructor.prototype.hasOwnProperty("attributeChangedCallback")) {
        originalAttributeChangedCallback = constructor.prototype.attributeChangedCallback;
      }

      // New attributeChangedCallback()
      constructor.prototype.attributeChangedCallback = function(attrName: string, oldValue: string, newValue: string): void {
        if (constructor._attributes_[attrName.toLowerCase()] !== undefined) {
          const metadata = (<AttributeMetadataMapping> constructor._attributes_)[attrName];

          // Apply filters.
          for (const filter of metadata.filters) {
            const updatedValue = filter.call(this, metadata.name, newValue);
            if (updatedValue === undefined) {
              return;
            }
            newValue = updatedValue;
          }

          if (oldValue !== newValue) {
            metadata.directSetter.call(this, newValue);
          }

          // Notify observers
          for (const observer of metadata.observers) {
            observer.call(this, metadata.name);
          }

          return;
        }

        if (originalAttributeChangedCallback !== null) {
          originalAttributeChangedCallback(attrName, oldValue, newValue);
        }
      };
    }

    window.customElements.define(options.tag.toLowerCase(), constructor);
    return constructor;
  };
}

/**
 * Mark a property as being a HTML attribute
 * 
 * See also `Observer` and `Filter`
 */
export function Attribute(proto: any, key: string): void {
  let defaultValue = proto[key];
  const valueMap = new WeakMap<any, any>();
  const attributeName = kebabCase(key);

  const getter = function (this: any) {
    console.log(`Get: ${key} => ${defaultValue}`);
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }

    return valueMap.get(this);
  };
  
  const setter = function (this: any, newValue: any): void {
    console.log(`Enter Set: ${key} => ${newValue}`);
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }

    if (newValue === valueMap.get(this)) {
      console.log(`  Set early exit`);
      return;
    }
    valueMap.set(this, newValue);
    this.setAttribute(attributeName, newValue);
    console.log(`Exit Set: ${key} => ${newValue}`);
  };

  const directSetter = function(this: any, newValue: any): void {
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }
    valueMap.set(this, newValue);
  }
  
  if (delete proto[key]) {
    Object.defineProperty(proto, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true
    });

    if ( ! proto.constructor.hasOwnProperty("_attributes_")) {
      proto.constructor._attributes_ = {};
    }
    const _attributes_: AttributeMetadataMapping = proto.constructor._attributes_;
    const metadata = {name: key, attributeName, directSetter, filters: [], observers: []};
    _attributes_[key] = metadata;
    _attributes_[metadata.attributeName] = metadata;
  }
}

/**
 * Method decorator for observing changes to a HTML attribute.
 * 
 * The decorated method is called with one parameter with the name of the
 * attribute which changed.
 * 
 * @param targets variable number of parameters naming the attributes which
 *          this method observes.
 */
export function Observe(...targets: string[]) {
  return function (proto: any, key: string, descriptor: PropertyDescriptor) {

    // Register this method as being an attribute observer.
    if ( ! proto.constructor.hasOwnProperty("_attributes_")) {
      proto.constructor._attributes_ = {};
    }
    const _attributes_: AttributeMetadataMapping = proto.constructor._attributes_;

    for (const target of targets) {
      if (_attributes_[target] === undefined) {
        const metadata = {name: target, attributeName: kebabCase(target), directSetter: null, filters: [], observers: []};
        _attributes_[target] = metadata;
        _attributes_[metadata.attributeName] = metadata;
      }
      const metadata = _attributes_[target];
      metadata.observers.push(proto[key]);
    }

    return descriptor;
  }
}

/**
 * Method decorator for 
 */
export function Filter(...target: string[]) {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {

    return descriptor;
  };
}
