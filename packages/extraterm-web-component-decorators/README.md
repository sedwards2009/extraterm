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
* Hard to use incorrectly; many errors are detected and reported at class creation time.
* Plays nice with other micro-library approaches.


Usage
-----
An example of basic usage looks like this:


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

This custom element can be used from HTML like so:
```html
<my-great-component
  great-message="Be nice to each other">
</my-great-component>
```

Here we see a custom element being defined using TypeScript. The class decorator at the top performs the registration of the element under tag `my-great-component`. All tag names must contain a `-`, as required by the Custom Element specification.

A `greatMessage` field is also defined using the normal TypeScript syntax. It is also made accessible via the HTML/DOM attribute interface as `great-message`. "Camel case" field names like `greatMessage` are automatically converted to "kabab case" attribute names.

The `@Filter` decorator lets us hook into how fields and attributes are set. `@Filter` takes a variable list of arguments which name the field to filter. When a field is set, then our filter method will be called. It can modify the new value and return it, or cancel the whole set process by returning `undefined`. Note that the attribute view of this property `great-message` will reflect the raw value which was set, but the JS property will reflect the filtered and cleaned up version which is used internally.

The `@Observe` decorator makes it possible for a method to be called when a field/attribute is changed. An observer method takes one parameter, the name JS name of the field which was set and changed.


Attributes and fields
---------------------
"Attributes" are HTML attributes which are set on tags via HTML, or set/get using the DOM methods `setAttribute()` and `getAttribute()`. "Fields" are normal JavaScript fields availabe on an object.

In the DOM all attributes are plain strings. Fields though, can have the type `string`, `number`, or `boolean`. The type of the field is found by the TypeScript type annotation used on the field, or by the default value used to initialize it. When an attribute is set, its value will automatically be converted to the correct data type before it is stored in the matching field.

This example shows different ways of initializing fields and making their data type clear.

```
@CustomElement("my-great-component")
class MyGreatComponent extends HTMLElement {

  @Attribute greatMessage: string;

  @Attribute okMessage = "hello";

  @Attribute hasFireworks = true;

  @Attribute fireworkRockets = 5;
}
```


JavaScript properties, setters, and getters
-------------------------------------------
It is also possible to apply `@Attribute` to a JavaScript setter.

```
@CustomElement("my-database-message-component")
class MyDatabaseMessageComponent extends HTMLElement {

  @Attribute
  get greatMessage(): string {
    return this._getMessageFromDatabase();
  }

  set greatMessage(message: string) {
    this._writeMessageToDatabase(message);
  }
}
```

`@Observe` and `@Filter` can't be used on fields which use a getter or setter.



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
