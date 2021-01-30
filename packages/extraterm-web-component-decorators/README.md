Extraterm Web Component Decorators
==================================


Introduction
------------
This is a small collection of related TypeScript class and method decorators to aid in creating Web Components and eliminating boilerplate code.

They are inspired by Stencil's and Polymer's decorators, but have a much more limited scope and different demands on the surrounding application style.

Design decisions:

* Designed for use with TypeScript and its decorators feature.
* Intended for use on modern browser engines, namely Chromium in the context of Electron apps.
* No polyfills or support for older browsers though. (It should be possible to use pollyfills though, but this isn't tested.)
* Doesn't require any special superclasses except HTMLElement which the Custom Element specification needs anyway.
* No special compile step required other than the normal TypeScript one.
* Hard to use incorrectly, many errors are detected and reported at class creation time.
* Plays nice with other micro-library approaches.


Usage
-----
```
@CustomElement("my-great-component")
class MyGreatComponent extends HTMLElement {

  @Attribute greatMessage: string;

  @Filter("greatMessage)
  private _onlyHappyMessages(msg: string): string {
    if (msg.toLowerCase().indexOf("happy") === -1) {
      return undefined;
    }
    return msg;
  }

  @Observe("greatMessage")
  private _messageToConsole(propertyName: string): void {
    console.log("greatMessage changed to " + this.greatMessage);
  }
}
```

In this example we can see a custom element being defined. The class decorator at the top also performs the registration of the element under tag `my-great-component`. It defines a `greatMessage` property which is also accessible via the HTML/DOM attribute interface as `great-message`. The default value for attributes needs to be passed to the decorator. It can't be set using the normal TypeScript syntax unfortunately. When a message is set we filter it internally before it reaches the JS property `greatMessage`. Keep in mind that the attribute view of this property `great-message` will reflect the value which the user set, but the JS version will be cleaned up and ready for internal use. Lastly, the `@Observe` decorator makes it possible for a method to be called when a property/attribute is changed.


Reference documentation
-----------------------
See the source code for detailed documentation about each decorator.


Compiling projects to use Extraterm Web Component Decorators
------------------------------------------------------------
TypeScript code which uses these decorators must be compiled with experimental decorators support on in the compiler. Use the option `experimentalDecorators` in `tsconfig.json`. Also it is recommended to turn on the `emitDecoratorMetadata` option too for improved error checking and warnings at runtime.


Unit Tests
----------
The unit tests for this run inside the browser.

Run:

`yarn run build`

and then this to start a local webserver:

`yarn run serve`

Open http://127.0.0.1:8080/src/test/ to load the test page and run the tests.


License
-------
MIT

-- Simon Edwards <simon@simonzone.com>
