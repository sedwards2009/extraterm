/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as reflect from 'reflect-metadata';


type FilterMethodName = string;
type ObserverMethodName = string;

type PropertyType = 'any' | 'String' | 'Number' | 'Boolean';

function jsTypeToPropertyType(name: string): PropertyType {
  if (name === "String" || name === "Number" || name === "Boolean") {
    return name;
  }
  return "any";
}

interface AttributeData {
  jsName: string;
  attributeName: string;
  dataType: PropertyType;
  instanceValueMap: WeakMap<any, any>;

  filters: FilterMethodName[];
  observers: ObserverMethodName[];
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}

const decoratorDataSymbol = Symbol("Custom Element Decorator Data");


/**
 * Class decorator for web components.
 *
 * This should appear at the top of classes which implement Custom Elements.
 *
 * @param tag The tag for this custom element written in kebab-case. As
 *            conform the Custom Element specification, this tag must contain
 *            a `-` (dash) character.
 */
export function CustomElement(tag: string): (target: any) => any {
  return function(constructor: any): any {
    const decoratorData = getDecoratorData(constructor.prototype);

    const interceptedConstructor = class extends constructor {
      constructor() {
        super();
        decoratorData.markInstanceConstructed(this);
      }

      getAttribute(attrName: string): any {
        const result = decoratorData.getAttribute(this, attrName);
        if (result !== undefined) {
          return result;
        }
        return super.getAttribute(attrName);
      }

      setAttribute(attrName: string, value: any): void {
        if ( ! decoratorData.setAttribute(this, attrName, value)) {
          super.setAttribute(attrName, value);
        }
      }

      hasAttribute(attrName: string): boolean {
        const result = decoratorData.hasAttribute(this, attrName);
        return result === undefined ? super.hasAttribute(attrName) : result;
      }

      removeAttribute(attrName: string): void {
        if ( ! decoratorData.removeAttribute(this, attrName)) {
          super.removeAttribute(attrName);
        }
      }
    };

    const tagLower = tag.toLowerCase();
    window.customElements.define(tagLower, interceptedConstructor);
    return interceptedConstructor;
  };
}

export function Attribute(prototype: any, key: string) {
  const decoratorData = getDecoratorData(prototype);
  decoratorData.installAttribute(prototype, key);
  return undefined;
}

function getDecoratorData(prototype: any): DecoratorData {
  if (prototype[decoratorDataSymbol] == null) {
    prototype[decoratorDataSymbol] = new DecoratorData(prototype);
  }
  return prototype[decoratorDataSymbol];
}


class DecoratorData {

  private _instanceConstructedMap = new WeakMap<any, boolean>();

  private _jsNameAttrDataMap = new Map<string, AttributeData>();
  //                              ^ Key is the js attribute name

  private _attrNameAttrDataMap = new Map<string, AttributeData>();
  //                                     ^ Key is a kebab-case attribute name.

  constructor(private _elementProto: any) {
  }

  markInstanceConstructed(instance: any): void {
    this._instanceConstructedMap.set(instance, true);
  }

  private _isInstanceConstructed(instance: any): boolean {
    return this._instanceConstructedMap.get(instance);
  }

  installAttribute(prototype: any, jsName: string): void {
    const decoratorData = this;
    const attrData = this._getOrCreateAttributeData(jsName);

    let propertyType: PropertyType = "any";
    const propertyTypeMetadata = Reflect.getMetadata("design:type", prototype, jsName);
    if (propertyTypeMetadata != null) {
      propertyType = jsTypeToPropertyType(propertyTypeMetadata.name);
    }
    attrData.dataType = propertyType;

    const getter = function(this: any): any {
      return attrData.instanceValueMap.get(this);
    };

    const setter = function(this: any, newStringValue: any): void {
      let newValue: any = newStringValue;
      if (attrData.dataType === "Number" && (typeof newValue !== "number")) {
        newValue = parseFloat(newStringValue);
      } else if (attrData.dataType === "Boolean" && (typeof newValue !== "boolean")) {
        newValue = newStringValue === attrData.attributeName || newStringValue === "" || newStringValue === "true";
      }

      // Filter
      for (const methodName of attrData.filters) {
        const updatedValue = this[methodName].call(this, newValue, jsName);
        if (updatedValue === undefined) {
          return;
        }
        newValue = updatedValue;
      }

      attrData.instanceValueMap.set(this, newValue);

      if (decoratorData._isInstanceConstructed(this)) {
        // FIXME
        // this[SetParentAttributeSymbol].call(this, attrData.attributeName, newValue);
      }

      // Notify observers
      for (const methodName of attrData.observers) {
        this[methodName].call(this, jsName);
      }
    };

    if (delete this._elementProto[jsName]) {
      Object.defineProperty(this._elementProto, jsName, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
      });
    }
  }

  private _getOrCreateAttributeData(jsName: string): AttributeData {
    const registration = this._jsNameAttrDataMap.get(jsName);
    if (registration != null) {
      return registration;
    }

    const attributeName = kebabCase(jsName);
    const newRegistration: AttributeData = {
      jsName,
      attributeName,
      dataType: null,
      instanceValueMap: new WeakMap<any, any>(),
      filters: [],
      observers: [],
    };

    this._jsNameAttrDataMap.set(jsName, newRegistration);
    this._attrNameAttrDataMap.set(attributeName, newRegistration);
    return newRegistration;
  }

  getAttribute(instance: any, attrName: string): any {
    const attrData = this._attrNameAttrDataMap.get(attrName);
    if (attrData === undefined) {
      return undefined;
    }

    const value = attrData.instanceValueMap.get(instance);
    if (attrData.dataType === "Boolean") {
      return value ? "" : null;
    }

    return value;
  }

  setAttribute(instance: any, attrName: string, value: any): boolean {
    const attrData = this._attrNameAttrDataMap.get(attrName);
    if (attrData === undefined) {
      return false;
    }

    instance[attrData.jsName] = value;
    return true;
  }

  hasAttribute(instance: any, attrName: string) : boolean {
    const attrData = this._attrNameAttrDataMap.get(attrName);
    if (attrData === undefined) {
      return undefined;
    }
    if (attrData.dataType !== "Boolean") {
      return undefined;
    }
    return instance[attrData.jsName];
  }

  removeAttribute(instance: any, attrName: string) : boolean {
    const attrData = this._attrNameAttrDataMap.get(attrName);
    if (attrData === undefined) {
      return false;
    }
    if (attrData.dataType !== "Boolean") {
      return false;
    }
    instance[attrData.jsName] = false;
    return true;
  }

  registerObserver(jsPropertyName: string, methodName: string): void {
    const attrData = this._getOrCreateAttributeData(jsPropertyName);
    attrData.observers.push(methodName);
  }

  registerFilter(jsPropertyName: string, methodName: string): void {
    const attrData = this._getOrCreateAttributeData(jsPropertyName);
    attrData.filters.push(methodName);
  }
}

/**
 * Method decorator for observing changes to a HTML attribute.
 *
 * The decorated method is called with one parameter; the name of the
 * attribute which changed. Note: The name is actually that of the
 * property. i.e. "someString" not "some-string".
 *
 * @param jsPropertyNames variable number of parameters naming the
 *                        attributes which this method observes.
 */
export function Observe(...jsPropertyNames: string[]) {
  return function (proto: any, methodName: string, descriptor: PropertyDescriptor) {
    const decoratorData = getDecoratorData(proto);
    for (const jsPropertyName of jsPropertyNames) {
      decoratorData.registerObserver(jsPropertyName, methodName);
    }
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
 * @param jsPropertyNames variable number of parameters naming the attributes
 *                        which this method filters.
 */
export function Filter(...jsPropertyNames: string[]) {
  return function(proto: any, methodName: string, descriptor: PropertyDescriptor) {
    const decoratorData = getDecoratorData(proto);
    for (const jsPropertyName of jsPropertyNames) {
      decoratorData.registerFilter(jsPropertyName, methodName);
    }
  };
}
