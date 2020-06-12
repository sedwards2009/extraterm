/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as nodeunit from 'nodeunit';
import { Attribute, Filter, Observe, CustomElement } from '../NewDecorators';


@CustomElement("string-component")
class StringComponent extends HTMLElement {

  @Attribute someString: string;

  @Observe("someString")
  private _someStringObserver(target: string): void {
    this.lastSomeString = this.someString;
  }

  lastSomeString: string;

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
    test.equals(sc.getAttribute("some-string"), "my string");
  });
  test.done();
}

export function testAttributeObserver(test: nodeunit.Test): void {
  someStringTest((sc: StringComponent): void => {
    sc.someString = "first string";
    sc.someString = "my string";
    test.equals(sc.lastSomeString, "my string");
  });
  test.done();
}

export function testStringAttributeViaHTML(test: nodeunit.Test): void {
  someStringTest((sc: StringComponent): void => {
    sc.setAttribute("some-string", "my string");
    test.equals(sc.getAttribute("some-string"), "my string");
    test.equals(sc.lastSomeString, "my string");
  });
  test.done();
}

@CustomElement("multi-string-component")
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

@CustomElement("filter-string-component")
class FilterStringComponent extends HTMLElement {

  @Attribute someString: string;

  @Filter("someString")
  private _toUpperCase(aString: string, target: string): string {
    return aString.toUpperCase();
  }

  @Attribute noSimonsString: string

  @Filter("noSimonsString")
  private _noSimonsFilter(aString: string, target: string): string {
    return aString.indexOf("Simon") !== -1 ? undefined : aString;
  }

  @Attribute shortString: string;

  @Filter("shortString")
  private _toLowerCase(aString: string): string {
    return aString.toLowerCase();
  }

  @Filter("shortString")
  private _trimString(aString: string): string {
    return aString.trim();
  }
}

function filterStringTest(guts: (sc: FilterStringComponent) => void): void {
  const sc = <FilterStringComponent> document.createElement("filter-string-component");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

export function testFilterStringAttributeViaJS(test: nodeunit.Test): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.someString = "my string";
    test.equals(sc.someString, "MY STRING");
    test.done();
  });
}

export function testFilterStringAttributeViaHTML(test: nodeunit.Test): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    test.equals(sc.someString, "MY STRING");
    test.done();
  });
}

export function testFilterStringAttributeViaJSWithReject(test: nodeunit.Test): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.noSimonsString = "Paul's string";
    test.equals(sc.noSimonsString, "Paul's string");

    sc.noSimonsString = "Simon's string";
    test.equals(sc.noSimonsString, "Paul's string");
    test.done();
  });
}

export function testFilter2StringAttributeViaJS(test: nodeunit.Test): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.shortString = "     MY String    ";
    test.equals(sc.shortString, "my string");
    test.done();
  });
}

export function testFilter2StringAttributeViaHTML(test: nodeunit.Test): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.setAttribute("short-string", "     MY String    ");
    test.equals(sc.shortString, "my string");
    test.done();
  });
}

@CustomElement("number-component")
class NumberComponent extends HTMLElement {

  @Attribute someNumber: number;

  @Observe("someNumber")
  private _someNumberObserver(target: string): void {
    this.lastSomeNumber = this.someNumber;
  }

  public lastSomeNumber: number;

}

function someNumberTest(guts: (sc: NumberComponent) => void): void {
  const sc = <NumberComponent> document.createElement("number-component");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

export function testNumberAttributeViaJS(test: nodeunit.Test): void {
  someNumberTest((sc: NumberComponent): void => {
    sc.someNumber = 123;
    test.equals(sc.getAttribute("some-number"), "123");
    test.equals(sc.someNumber, 123);
    test.equals(sc.lastSomeNumber, 123);
    test.equals(typeof sc.lastSomeNumber, "number");

    test.done();
  });
}

export function testNumberAttributeViaHTML(test: nodeunit.Test): void {
  someNumberTest((sc: NumberComponent): void => {
    sc.setAttribute("some-number", "321");
    test.equals(sc.getAttribute("some-number"), "321");
    test.equals(sc.lastSomeNumber, 321);
    test.equals(typeof sc.lastSomeNumber, "number");
  });
  test.done();
}

@CustomElement("boolean-component")
class BooleanComponent extends HTMLElement {

  @Attribute someBoolean: boolean;

  @Observe("someBoolean")
  private _someBooleanObserver(target: string): void {
    this.lastSomeBoolean = this.someBoolean;
  }

  public lastSomeBoolean: boolean;

}

function someBooleanTest(guts: (sc: BooleanComponent) => void): void {
  const sc = <BooleanComponent> document.createElement("boolean-component");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

export function testBooleanAttributeViaJS(test: nodeunit.Test): void {
  someBooleanTest((sc: BooleanComponent): void => {
    sc.someBoolean = false;
    test.equals(sc.getAttribute("some-boolean"), "false");
    test.equals(sc.someBoolean, false);
    test.equals(sc.lastSomeBoolean, false);
    test.equals(typeof sc.lastSomeBoolean, "boolean");

    test.done();
  });
}

export function testBooleanAttributeViaHTML(test: nodeunit.Test): void {
  someBooleanTest((sc: BooleanComponent): void => {
    sc.setAttribute("some-boolean", "false");
    test.equals(sc.getAttribute("some-boolean"), "false");
    test.equals(sc.lastSomeBoolean, false);
    test.equals(typeof sc.lastSomeBoolean, "boolean");
  });
  test.done();
}

/*

// TODO should we support @Observe on attributes in the superclass?
@CustomElement("substring-component")
class SubStringComponent extends StringComponent {

  @Observe("someString")
  private _subSomeStringObserver(target: string): void {
    this.subLastSomeString = this.someString;
  }

  public subLastSomeString: string;
}

export function testSubclassObserve(test: nodeunit.Test): void {
  const sc = <SubStringComponent> document.createElement("substring-component");
  document.body.appendChild(sc);
  sc.someString = "blah";
  test.equals(sc.lastSomeString, "blah");
  test.equals(sc.subLastSomeString, "blah");

  test.done();
}
*/

@CustomElement("defaults-component")
class DefaultsComponent extends HTMLElement {

  @Attribute someString = "foo";
  @Attribute someNumber = 123;
  @Attribute someBoolean= false;
}

export function testDefaults(test: nodeunit.Test): void {
  const ic = <DefaultsComponent> document.createElement("defaults-component");
  document.body.appendChild(ic);

  test.equals(typeof ic.someString, "string");
  test.equals(ic.someString, "foo");

  test.equals(typeof ic.someNumber, "number");
  test.equals(ic.someNumber, 123);

  test.equals(typeof ic.someBoolean, "boolean");
  test.equals(ic.someBoolean, false);

  test.done();
}
