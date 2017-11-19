Extraterm Web Component Decorators
==================================

This is a small collection of related TypeScript class and method decorators to aid in creating Web Components.

They are inspired by Stencil's and Polymer's decorators, but have a much more limited scope.

* Intended for use on modern browser engines, namely Chromium in the context of Electron apps.
* Class based, but doesn't require any special superclass except HTMLElement which the Custom Element specification needs anyway.
* No compile step required
* No polyfills or support for older browsers though


Decorators
==========

Example
=======

```
@WebComponent({tag: "my-great-component"})
class MyGreatComponent extends HTMLElement {

  @Attribute greatMessage: string;

  @Observe("greatMessage")
  private _messageToConsole(propertyName: string): void {
    console.log("greatMessage changed to " + this.greatMessage);
  }



}
```


@WebComponent
-------------


@Attribute
----------


@Observe
--------


@Filter
-------





TypeScript code which uses these decorators must be compiled with experimental decorators support on, option `experimentalDecorators` in `tsconfig.json`.
