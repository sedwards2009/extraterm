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
    test.equals(sc.getAttribute("some-string"), "my string");
    test.equals(sc.someString, "my string");
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

@WebComponent({tag: "multi-string-component"})
class MultiStringComponent extends HTMLElement {

  @Attribute someString: string;

  @Observe("someString")
  private _someStringObserver(target: string): void {
    this.lastSomeString = this.someString;
  }

  @Observe("someString")
  private _someStringObserver2(target: string): void {
    this.lastSomeString2 = this.someString;
  }

  public lastSomeString: string;
  public lastSomeString2: string;

  @Attribute otherString: string;

  @Observe("someString", "otherString")
  private _stringsObserver(target: string): void {
    console.log(`_stringsObserver(${target})`);
    if (target === "someString") {
      this.lastSomeStringMulti = this.someString;
    } else if (target === "otherString") {
      this.lastOtherStringMulti = this.otherString;
    }
  }

  public lastSomeStringMulti: string;
  public lastOtherStringMulti: string;
}

function multiSomeStringTest(guts: (sc: MultiStringComponent) => void): void {
  const sc = <MultiStringComponent> document.createElement("multi-string-component");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

export function testMultiStringAttributeViaJS(test: nodeunit.Test): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.someString = "my string";
    test.equals(sc.someString, "my string");
    test.equals(sc.lastSomeString, "my string");
    test.equals(sc.lastSomeString2, "my string");
    test.done();
  });
}

export function testMultiStringAttributeViaHTML(test: nodeunit.Test): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    test.equals(sc.getAttribute("some-string"), "my string");
    test.equals(sc.lastSomeString, "my string");
    test.equals(sc.lastSomeString2, "my string");
    test.done();
  });
}

export function testMultiStringAttributeViaHTMLWithMultiobserver(test: nodeunit.Test): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    sc.setAttribute("other-string", "my other string");

    test.equals(sc.lastSomeStringMulti, "my string");
    test.equals(sc.lastOtherStringMulti, "my other string");
    test.done();
  });
}

export function testMultiStringAttributeViaJSWithMultiobserver(test: nodeunit.Test): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.someString = "my string";
    sc.otherString = "my other string";

    test.equals(sc.lastSomeStringMulti, "my string");
    test.equals(sc.lastOtherStringMulti, "my other string");
    test.done();
  });
}
