/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as reflect from 'reflect-metadata';

require('reflect-metadata');  // Ensure that it is actually imported and not elided by tsc.

export interface WebComponentOptions {
  // The tag name to register this component under. This must conform to the
  // requirements set down in the Custom Element spec and contain a hyphen.
  tag: string;
}

const ATTRIBUTES_REGISTRATION_KEY = "_attributes_";
const OBSERVERS_REGISTRATION_KEY = "_observers_";

type FilterMethod = (value: any, target: string) => any;
type FilterRegistration = {name: string, method: FilterMethod};


type PropertyType = 'any' | 'String' | 'Number' | 'Boolean';

interface AttributeRegistration {
  name: string;
  directSetter: (newValue: any) => void;
  attributeName: string;
  dataType: PropertyType;

  filterRegistrations: FilterRegistration[];
}
type AttributeRegistrationsMapping = Map<string, AttributeRegistration>;

type ObserverMethod = (target: string) => void;

interface ObserverRegistration {
  name: string;
  attributeName: string;
  methodName: string;
  method: ObserverMethod;
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

    let attributeRegistrations: AttributeRegistrationsMapping = null;
    if (constructor.hasOwnProperty(ATTRIBUTES_REGISTRATION_KEY)) {
      attributeRegistrations = constructor[ATTRIBUTES_REGISTRATION_KEY];
    }

    let observerRegistrations: ObserverRegistration[] = null;
    if (constructor.hasOwnProperty(OBSERVERS_REGISTRATION_KEY)) {
      observerRegistrations = constructor[OBSERVERS_REGISTRATION_KEY];
    }

    if (attributeRegistrations != null || observerRegistrations != null) {
      if (attributeRegistrations != null) {
        validateAllFilters(constructor.prototype, attributeRegistrations);
      }

      if (observerRegistrations != null) {
        validateObservers(observerRegistrations, constructor, attributeRegistrations);
      }

      // Set up `observedAttributes` and `attributeChangedCallback()`
      Object.defineProperty(constructor, "observedAttributes", {
        get: function() {
          let observedAttributeNames = new Set<string>();

          if (attributeRegistrations != null) {
            // We observe our own attributes for update purposes.
            for (const [key, registration] of attributeRegistrations.entries()) {
              if (registration.attributeName !== null) {
                observedAttributeNames.add(registration.attributeName);
              }
            }
          }

          // We also observe the attributes targetted by @Observe
          if (observerRegistrations != null) {
            for (const observerRegistration of observerRegistrations) {
              observedAttributeNames.add(observerRegistration.attributeName);
            }
          }

          // Don't forget the ones from the superclass.
          const superObservedAttributes = constructor.prototype.__proto__.constructor.observedAttributes;
          if (superObservedAttributes !== undefined) {
            for (const attr of superObservedAttributes) {
              observedAttributeNames.add(attr);
            }
          }
          return observedAttributeNames;
        },
        enumerable: true,
        configurable: true
      });

      let originalAttributeChangedCallback = null;
      if (constructor.prototype["attributeChangedCallback"] !== undefined) {
        originalAttributeChangedCallback = constructor.prototype.attributeChangedCallback;
      }

      // New attributeChangedCallback()
      constructor.prototype.attributeChangedCallback = function(attrName: string, oldValue: string, newStringValue: string): void {
        if (originalAttributeChangedCallback !== null) {
          originalAttributeChangedCallback.call(this, attrName, oldValue, newStringValue);
        }

        const attrNameLower = attrName.toLowerCase();
        if (attributeRegistrations != null) {
          for (const [key, registration] of attributeRegistrations) {
            if (registration.attributeName !== attrNameLower) {
              continue;
            }

            let newValue: any = newStringValue;
            if (registration.dataType === "Number") {
              newValue = parseFloat(newStringValue);
            } else if (registration.dataType === "Boolean") {
              newValue = newStringValue === attrName || newStringValue === "" || newStringValue === "true";
            }

            // Apply filters.
            for (const filter of registration.filterRegistrations) {
              const updatedValue = filter.method.call(this, newValue, registration.name);
              if (updatedValue === undefined) {
                return;
              }
              newValue = updatedValue;
            }

            if (oldValue !== newValue) {
              registration.directSetter.call(this, newValue);
            }

            break;
          }
        }

        // Notify observers
        if (observerRegistrations != null) {
          for (const observerRegistration of observerRegistrations) {
            if (observerRegistration.attributeName === attrNameLower) {
              observerRegistration.method.call(this, observerRegistration.name);
            }
          }
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

function validateAllFilters(prototype: Object, attributes: AttributeRegistrationsMapping): void {
  for (const attributeMetadata of collectUniqueMetadatas(attributes)) {
    validateFilters(prototype, attributeMetadata);
  }
}

function collectUniqueMetadatas(attributes: AttributeRegistrationsMapping): Set<AttributeRegistration> {
  return new Set<AttributeRegistration>(attributes.values());
}

function validateFilters(prototype: Object, attributeMetadata: AttributeRegistration): void {
  for (const filter of attributeMetadata.filterRegistrations) {
    if (attributeMetadata.attributeName === null) {
      console.warn(`Filter method '${filter.name}' is attached to undefined property '${attributeMetadata.name}'.`);
    }

    const methodParameters = Reflect.getMetadata("design:paramtypes", prototype, filter.name);
    if (methodParameters != null) {
      if (methodParameters.length !== 1 && methodParameters.length !== 2) {
        console.warn(`Filter method '${filter.name}' on property '${attributeMetadata.name}' has the wrong number of parameters. It should have 1 or 2 instead of ${methodParameters.length}.`);
      } else {
        const firstParameterType = jsTypeToPropertyType(methodParameters[0].name);
        if (firstParameterType !== "any" && attributeMetadata.dataType !== "any" && firstParameterType !== attributeMetadata.dataType) {
          console.warn(`Filter method '${filter.name}' on property '${attributeMetadata.name}' has the wrong parameter type. Expected '${attributeMetadata.dataType}', found '${methodParameters[0].name}'.`);
        }
        if (methodParameters.length === 2) {
          if (methodParameters[1].name !== "String") {
            console.warn(`Filter method '${filter.name}' on property '${attributeMetadata.name}' has the wrong 2nd parameter type. Expected 'String', found '${methodParameters[1].name}'.`);
          }
        }
      }
    }

    // Check that the return type matches the attribute type.
    const returnTypeMeta = Reflect.getMetadata("design:returntype", prototype, filter.name);
    if (returnTypeMeta != null) {
      const returnType = jsTypeToPropertyType(returnTypeMeta.name);
      if (returnType !== "any" && attributeMetadata.dataType !== "any" && attributeMetadata.dataType !== returnType) {
        console.warn(`Filter method '${filter.name}' on property '${attributeMetadata.name}' has the wrong return type. Expected '${attributeMetadata.dataType}', found '${returnType}'.`);
      }
    }
  }
}

function validateObservers(observerRegistrations: ObserverRegistration[], constructor: any,
    attributeRegistrations: AttributeRegistrationsMapping): void {

  const acceptableAttributes = new Set<string>();
      
  if (attributeRegistrations != null) {
    for (const [key, registration] of attributeRegistrations.entries()) {
      acceptableAttributes.add(registration.attributeName);
    }
  }

  const superObservedAttributes = constructor.prototype.__proto__.constructor.observedAttributes;
  if (superObservedAttributes !== undefined) {
    for (const attr of superObservedAttributes) {
      acceptableAttributes.add(attr);
    }
  }

  for (const observerRegistration of observerRegistrations) {
    if ( ! acceptableAttributes.has(observerRegistration.attributeName)) {
      console.warn(`Observer method '${observerRegistration.methodName}' is attached to undefined property '${observerRegistration.name}'.`);
    }
  }
}

export interface AttributeOptions {
  default: string | number | boolean;
}

/**
 * Mark a property as being a HTML attribute.
 * 
 * The property will exposed as an HTML attribute. The name of the attribute
 * is in kebab-case. i.e. the words of the property lower case and separated
 * be dashes. For example "someString" become attribute "some-string".
 * 
 * This decorator can be used in two ways. The direct way is with no
 * arguments, and the second way is with an options object as the single argument.
 * The options object can be used to specify a default (internal) value for
 * the attribute/property.
 * 
 * See also `Observer` and `Filter`
 */
export function Attribute(protoOrOptions: AttributeOptions | any, key?: string): any {
  if (arguments.length === 1) {
    const options = <AttributeOptions> protoOrOptions;
    const defaultValue = options.default;
    return (proto: any, key: string): void => {
      applyAttribute(proto, key, defaultValue);
    };
  } else {
    applyAttribute(<any> protoOrOptions, key, undefined);
    return undefined;
  }
}

export function applyAttribute(proto: any, key: string, defaultValue: any): void {
  const valueMap = new WeakMap<any, any>();
  const attributeName = kebabCase(key);

  let propertyType: PropertyType = "any";
  const propertyTypeMetadata = Reflect.getMetadata("design:type", proto, key);
  if (propertyTypeMetadata != null) {
    propertyType = jsTypeToPropertyType(propertyTypeMetadata.name);
  }

  validateAttributeDefaultValue(key, propertyType, defaultValue);

  const getter = function (this: any) {
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }

    return valueMap.get(this);
  };
  
  const setter = function (this: any, newValue: any): void {
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }

    if (newValue === valueMap.get(this)) {
      return;
    }

    this.setAttribute(attributeName, newValue);
  };

  const directSetter = function(this: any, newValue: any): void {
    if ( ! valueMap.has(this)) {
      valueMap.set(this, defaultValue);
    }
    valueMap.set(this, newValue);
  };
  
  if (delete proto[key]) {
    Object.defineProperty(proto, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true
    });

    if ( ! proto.constructor.hasOwnProperty(ATTRIBUTES_REGISTRATION_KEY)) {
      proto.constructor[ATTRIBUTES_REGISTRATION_KEY] = new Map();
    }
    const attributes: AttributeRegistrationsMapping = proto.constructor[ATTRIBUTES_REGISTRATION_KEY];

    let metadata: AttributeRegistration = attributes.get(key);
    if (metadata === undefined) {
      metadata = {name: key, attributeName, dataType: propertyType, directSetter, filterRegistrations: []};
    } else {
      metadata.attributeName = propertyType;
    }

    attributes.set(key,  metadata);
  }
}

function validateAttributeDefaultValue(key: string, propertyType: PropertyType, defaultValue: any): void {
  if (propertyType === "any" || defaultValue === undefined) {
    return;
  }

  switch (propertyType) {
    case "String":
      if (defaultValue === null || (typeof defaultValue) === "string") {
        return;
      }
      break;
    case "Number":
      if ((typeof defaultValue) === "number" || defaultValue === null) {
        return;
      }
      break;
    case "Boolean":
      if ((typeof defaultValue) === "boolean" || defaultValue === null) {
        return;
      }
      break;
  }

  console.warn(`Default value for property '${key}' has type '${typeof defaultValue}', expected type '${propertyType}'.`);
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
  return function (proto: any, methodName: string, descriptor: PropertyDescriptor) {

    // Register this method as being an attribute observer.
    if ( ! proto.constructor.hasOwnProperty(OBSERVERS_REGISTRATION_KEY)) {
      proto.constructor[OBSERVERS_REGISTRATION_KEY] = [];
    }
    const attributes: ObserverRegistration[] = proto.constructor[OBSERVERS_REGISTRATION_KEY];
  
    for (const target of targets) {
      const metadata: ObserverRegistration = {
        name: target,
        attributeName: kebabCase(target),
        method: proto[methodName],
        methodName: methodName
      };
      attributes.push(metadata);
    }
    return descriptor;
  };
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
  return function(proto: any, methodName: string, descriptor: PropertyDescriptor) {

    // Register this method as being an attribute observer.
    if ( ! proto.constructor.hasOwnProperty(ATTRIBUTES_REGISTRATION_KEY)) {
      proto.constructor[ATTRIBUTES_REGISTRATION_KEY] = new Map();
    }
    const attributes: AttributeRegistrationsMapping = proto.constructor[ATTRIBUTES_REGISTRATION_KEY];
  
    for (const target of targets) {
      if ( ! attributes.has(target)) {
        const metadata: AttributeRegistration = {name: target, attributeName: null, dataType: 'any', directSetter: null, filterRegistrations: []};
        attributes.set(target, metadata);
      }
      const metadata = attributes.get(target);
      metadata.filterRegistrations.push({name: methodName, method: proto[methodName]});
    }

    return descriptor;
  };
}
