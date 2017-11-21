/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as reflect from 'reflect-metadata';

export interface WebComponentOptions {
  // The tag name to register this component under. This must conform to the
  // requirements set down in the Custom Element spec and contain a hyphen.
  tag: string;
}


type FilterMethod = {name: string, method: (value: any, target: string) => any};
type ObserverMethod = {name: string, method: (target: string) => void};

type PropertyType = 'any' | 'String' | 'Number' | 'Boolean';

interface AttributeMetadata {
  name: string;
  directSetter: (newValue: any) => void;
  attributeName: string;
  dataType: PropertyType;

  filters: FilterMethod[];
  observers: ObserverMethod[];
}

interface AttributeMetadataMapping {
  [key: string]: AttributeMetadata;
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}

function jsTypeToPropertyType(name: string): PropertyType {
  if (name === "String" || name === "Number" || name === "Boolean") {
    return name;
  }
  return "any";
}

/**
 * Class decorator for web components.
 * 
 * This should appear at the top of classes which implement Custom Elements.
 */
export function WebComponent(options: WebComponentOptions): (target: any) => any {
  return function(constructor: any): any {
    if (constructor.hasOwnProperty("_attributes_")) {
      const _attributes_: AttributeMetadataMapping = constructor._attributes_;

      validateAllFilters(constructor.prototype, _attributes_);

      // Set up `observedAttributes` and `attributeChangedCallback()`
      Object.defineProperty(constructor, "observedAttributes", {
        get: function() {
          return Object.keys(_attributes_);
        },
        enumerable: true,
        configurable: true
      });

      let originalAttributeChangedCallback = null;
      if (constructor.prototype.hasOwnProperty("attributeChangedCallback")) {
        originalAttributeChangedCallback = constructor.prototype.attributeChangedCallback;
      }

      // New attributeChangedCallback()
      constructor.prototype.attributeChangedCallback = function(attrName: string, oldValue: string, newStringValue: string): void {
        if (originalAttributeChangedCallback !== null) {
          originalAttributeChangedCallback(attrName, oldValue, newStringValue);
        }

        if (_attributes_[attrName.toLowerCase()] !== undefined) {
          const metadata = _attributes_[attrName];

          let newValue: any = newStringValue;
          if (metadata.dataType === "Number") {
            newValue = parseInt(newStringValue, 10);
          } else if (metadata.dataType === "Boolean") {
            newValue = newStringValue === attrName || newStringValue === "" || newStringValue === "true";
          }

          // Apply filters.
          for (const filter of metadata.filters) {
            const updatedValue = filter.method.call(this, newValue, metadata.name);
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
            observer.method.call(this, metadata.name);
          }

          return;
        }

      };
    }

    // Check for double registration with the same tag.
    const tag = options.tag.toLowerCase();
    const previousRegistration = window.customElements.get(tag);
    if (previousRegistration !== undefined) {
      console.warn(`A Custom Element with name '${tag}' is already registered.`);
      return constructor;
    }

    window.customElements.define(tag, constructor);
    return constructor;
  };
}

function validateAllFilters(prototype: Object, _attributes_: AttributeMetadataMapping): void {
  for (const attributeMetadata of collectUniqueMetadatas(_attributes_)) {
    validateFilters(prototype, attributeMetadata);
  }
}

function collectUniqueMetadatas(_attributes_: AttributeMetadataMapping): Set<AttributeMetadata> {
  const uniqueMetadataObjects = new Set<AttributeMetadata>();
  for (const key in _attributes_) {
    if (_attributes_.hasOwnProperty(key)) {
      uniqueMetadataObjects.add(_attributes_[key]);
    }
  }
  return uniqueMetadataObjects;
}

function validateFilters(prototype: Object, attributeMetadata: AttributeMetadata): void {
  for (const filter of attributeMetadata.filters) {
    const methodParameters = Reflect.getMetadata("design:paramtypes", prototype, filter.name);
    if (methodParameters != null) {
      if (methodParameters.length !== 1 && methodParameters.length !== 2) {
        console.warn(`Filter method '${filter.name}' has the wrong number of parameters. It should have 1 or 2 instead of ${methodParameters.length}.`);
      } else {
        const firstParameterType = jsTypeToPropertyType(methodParameters[0].name);
        if (firstParameterType !== "any" && attributeMetadata.dataType !== "any" && firstParameterType !== attributeMetadata.dataType) {
          console.warn(`Filter method '${filter.name}' has the wrong parameter type. Expected '${attributeMetadata.dataType}', found '${methodParameters[0].name}'.`);
        }
        if (methodParameters.length === 2) {
          if (methodParameters[1].name !== "String") {
            console.warn(`Filter method '${filter.name}' has the wrong 2nd parameter type. Expected 'String', found '${methodParameters[1].name}'.`);
          }
        }
      }
    }

    // Check that the return type matches the attribute type.
    const returnTypeMeta = Reflect.getMetadata("design:returntype", prototype, filter.name);
    if (returnTypeMeta != null) {
      const returnType = jsTypeToPropertyType(returnTypeMeta.name);
      if (returnType !== "any" && attributeMetadata.dataType !== "any" && attributeMetadata.dataType !== returnType) {
        console.warn(`Filter method '${filter.name}' has the wrong return type. Expected '${attributeMetadata.dataType}', found '${returnType}'.`);
      }
    }
  }
}

/**
 * Mark a property as being a HTML attribute.
 * 
 * The property will exposed as an HTML attribute. The name of the attribute
 * is in kebab-case. i.e. the words of the property lower case and separated
 * be dashes. For example "someString" become attribute "some-string".
 * 
 * See also `Observer` and `Filter`
 */
export function Attribute(proto: any, key: string): void {
  let defaultValue = proto[key];
  const valueMap = new WeakMap<any, any>();
  const attributeName = kebabCase(key);

  let propertyType: PropertyType = "any";
  const propertyTypeMetadata = Reflect.getMetadata("design:type", proto, key);
  if (propertyTypeMetadata != null) {
    console.log(`propertyTypeMetadata.name: ${propertyTypeMetadata.name}`);
    propertyType = jsTypeToPropertyType(propertyTypeMetadata.name);
  }

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
    const metadata = {name: key, attributeName, dataType: propertyType, directSetter, filters: [], observers: []};
    _attributes_[key] = metadata;
    _attributes_[metadata.attributeName] = metadata;
  }
}

function registerAttributeCallback(type: "observers" | "filters", proto: any, methodName: string, targets: string[]): void {
  // Register this method as being an attribute observer.
  if ( ! proto.constructor.hasOwnProperty("_attributes_")) {
    proto.constructor._attributes_ = {};
  }
  const _attributes_: AttributeMetadataMapping = proto.constructor._attributes_;

  for (const target of targets) {
    if (_attributes_[target] === undefined) {
      const metadata: AttributeMetadata = {name: target, attributeName: kebabCase(target), dataType: 'any', directSetter: null, filters: [], observers: []};
      _attributes_[target] = metadata;
      _attributes_[metadata.attributeName] = metadata;
    }
    const metadata = _attributes_[target];
    if (type === "observers") {
      metadata.observers.push({name: methodName, method: proto[methodName]});
    } else {
      metadata.filters.push({name: methodName, method: proto[methodName]});
    }
  }
}

/**
 * Method decorator for observing changes to a HTML attribute.
 * 
 * The decorated method is called with one parameter; the name of the
 * attribute which changed. Note: The name is actually that of the
 * property. i.e. "someString" not "some-string".
 * 
 * @param targets variable number of parameters naming the attributes which
 *          this method observes.
 */
export function Observe(...targets: string[]) {
  return function (proto: any, key: string, descriptor: PropertyDescriptor) {
    registerAttributeCallback("observers", proto, key, targets);
    return descriptor;
  }
}

/**
 * Method decorator to apply a filter to the value set on a HTML attribute.
 * 
 * The method can have one or two parameters. The first is the value which
 * needs to be filtered. The second optional parameter is the name of the
 * attribute the value is for. The method must return the new filtered value,
 * or `undefined` to indicate that the 
 * 
 * Note that the filter doesn't affect the value of the HTML attribute set,
 * but it does affect the internal value directly accessible via the JS field.
 * Also these filters can only be used for attributes which have been created
 * using the `Attribute` decorator.
 * 
 * @param targets variable number of parameters naming the attributes which
 *          this method filters.
 */
export function Filter(...targets: string[]) {
  return function(proto: any, key: string, descriptor: PropertyDescriptor) {
    registerAttributeCallback("filters", proto, key, targets);
    return descriptor;
  };
}
