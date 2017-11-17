/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as nodeunit from 'nodeunit';
import {Attribute, Observe, WebComponent} from '../src/Decorators';

@WebComponent({tag: "string-component"})
class StringComponent extends HTMLElement {

  @Attribute someString: string;

  @Observe("someString")
  private _someStringObserver(target: string): void {
    this.lastSomeString = this.someString;
  }

  public lastSomeString: string;

}

function someStringTest(guts: (sc: StringComponent) => void): void {
  const sc = <StringComponent> document.createElement("string-component");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

export function testStringAttributeViaJS(test: nodeunit.Test): void {
  someStringTest((sc: StringComponent): void => {
    sc.someString = "my string";
    test.equals(sc.someString, "my string");

    test.done();
  });
}

export function testStringAttributeViaJSObserve(test: nodeunit.Test): void {
  someStringTest((sc: StringComponent): void => {
    sc.someString = "my string";
    test.equals(sc.lastSomeString, "my string");

    test.done();
  });
}


export function testStringAttributeViaHTML(test: nodeunit.Test): void {
  const sc = <StringComponent> document.createElement("string-component");
  document.body.appendChild(sc);

  sc.setAttribute("some-string", "my string");
  test.equals(sc.getAttribute("some-string"), "my string");
  test.equals(sc.lastSomeString, "my string");

  test.done();
}
