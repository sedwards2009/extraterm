/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as reflect from 'reflect-metadata';


type FilterMethod = (value: any, target: string) => any;
type ObserverMethodName = string;

interface AttributeData {
  jsName: string;
  attributeName: string;

  instanceValueMap: WeakMap<any, any>;

  // kebabName: string;

  // key: Symbol;
  // getter: () => any;
  // directSetter: (newValue: any) => void;
  // attributeName: string;
  // dataType: PropertyType;

  filters: FilterMethod[];
  observers: ObserverMethodName[];
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}

const decoratorDataSymbol = Symbol("Custom Element Decorator Data");
// const SetParentAttributeSymbol = Symbol("SetParentAttribute");


/**
 * Class decorator for web components.
 *
 * This should appear at the top of classes which implement Custom Elements.
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
    };

    const tagLower = tag.toLowerCase();
    window.customElements.define(tagLower, interceptedConstructor);
    return interceptedConstructor;
  };
}

export function Attribute(prototype: any, key: string) {
  const decoratorData = getDecoratorData(prototype);
  decoratorData.installAttribute(key);
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

  installAttribute(jsName: string): void {
    const decoratorData = this;
    const attrData = this._getOrCreateAttributeData(jsName);

    const getter = function(this: any): any {
      return attrData.instanceValueMap.get(this);
    };

    const setter = function(this: any, newValue: any): void {
      // Filter

      attrData.instanceValueMap.set(this, newValue);
      if (decoratorData._isInstanceConstructed(this)) {

// console.log(`this[SetParentAttributeSymbol]`, this[SetParentAttributeSymbol]);

        // this[SetParentAttributeSymbol].call(this, attrData.attributeName, newValue);
      }

      // Notify observers
      for (const methodName of attrData.observers) {
console.log(`this[methodName]`, this[methodName]);
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

    return attrData.instanceValueMap.get(instance);
  }

  setAttribute(instance: any, attrName: string, value: any): boolean {
    const attrData = this._attrNameAttrDataMap.get(attrName);
    if (attrData === undefined) {
      return false;
    }

    instance[attrData.jsName] = value;
    return true;
  }

  registerObserver(jsPropertyName: string, methodName: string): void {
    const attrData = this._getOrCreateAttributeData(jsPropertyName);
    attrData.observers.push(methodName);
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
 * @param targets variable number of parameters naming the attributes which
 *          this method filters.
 */
export function Filter(...targets: string[]) {
  return function(proto: any, methodName: string, descriptor: PropertyDescriptor) {
  };
}
