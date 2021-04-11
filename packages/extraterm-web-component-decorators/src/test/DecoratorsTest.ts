/*
 * Copyright 2017-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { assert } from "chai";
import { Attribute, Filter, Observe, CustomElement } from '../Decorators';


//-------------------------------------------------------------------------
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

it("String attribute via JS", function(): void {
  someStringTest((sc: StringComponent): void => {
    sc.someString = "my string";
    assert.equal(sc.someString, "my string");
    assert.equal(sc.getAttribute("some-string"), "my string");
  });
});


it("Attribute Observer", function(): void {
  someStringTest((sc: StringComponent): void => {
    sc.someString = "first string";
    sc.someString = "my string";
    assert.equal(sc.lastSomeString, "my string");
  });
});

it("String Attribute via HTML", function(): void {
  someStringTest((sc: StringComponent): void => {
    sc.setAttribute("some-string", "my string");
    assert.equal(sc.getAttribute("some-string"), "my string");
    assert.equal(sc.lastSomeString, "my string");
  });
});

//-------------------------------------------------------------------------
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

it("MultiStringAttributeViaJS", function(): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.someString = "my string";
    assert.equal(sc.someString, "my string");
    assert.equal(sc.lastSomeString, "my string");
    assert.equal(sc.lastSomeString2, "my string");

  });
});

it("Multi-string attribute via HTML", function(): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    assert.equal(sc.getAttribute("some-string"), "my string");
    assert.equal(sc.lastSomeString, "my string");
    assert.equal(sc.lastSomeString2, "my string");

  });
});

it("Multi-string attribute via HTML with multi-observer", function(): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    sc.setAttribute("other-string", "my other string");

    assert.equal(sc.lastSomeStringMulti, "my string");
    assert.equal(sc.lastOtherStringMulti, "my other string");

  });
});

it("Multi-string attribute via JS with multi-observer", function(): void {
  multiSomeStringTest((sc: MultiStringComponent): void => {
    sc.someString = "my string";
    sc.otherString = "my other string";

    assert.equal(sc.lastSomeStringMulti, "my string");
    assert.equal(sc.lastOtherStringMulti, "my other string");

  });
});

//-------------------------------------------------------------------------
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

it("Filter string attribute via JS", function(): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.someString = "my string";
    assert.equal(sc.someString, "MY STRING");

  });
});

it("Filter string attribute via HTML", function(): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.setAttribute("some-string", "my string");
    assert.equal(sc.someString, "MY STRING");

  });
});

it("Filter string attribute via JS with Reject", function(): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.noSimonsString = "Paul's string";
    assert.equal(sc.noSimonsString, "Paul's string");

    sc.noSimonsString = "Simon's string";
    assert.equal(sc.noSimonsString, "Paul's string");

  });
});

it("Filter 2 String attribute via JS", function(): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.shortString = "     MY String    ";
    assert.equal(sc.shortString, "my string");

  });
});

it("Filter 2 String attribute via HTML", function(): void {
  filterStringTest((sc: FilterStringComponent): void => {
    sc.setAttribute("short-string", "     MY String    ");
    assert.equal(sc.shortString, "my string");

  });
});

//-------------------------------------------------------------------------

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

it("Number attribute via JS", function(): void {
  someNumberTest((sc: NumberComponent): void => {
    sc.someNumber = 123;
    assert.equal(sc.getAttribute("some-number"), "123");
    assert.equal(sc.someNumber, 123);
    assert.equal(sc.lastSomeNumber, 123);
    assert.equal(typeof sc.lastSomeNumber, "number");
  });
});

it("Number attribute via HTML", function(): void {
  someNumberTest((sc: NumberComponent): void => {
    sc.setAttribute("some-number", "321");
    assert.equal(sc.getAttribute("some-number"), "321");
    assert.equal(sc.lastSomeNumber, 321);
    assert.equal(typeof sc.lastSomeNumber, "number");
  });
});

//-------------------------------------------------------------------------
@CustomElement("boolean-component")
class BooleanComponent extends HTMLElement {

  constructor() {
    super();
    console.log(`BooleanComponent exit`);
  }

  @Attribute someBoolean = false;

  @Observe("someBoolean")
  private _someBooleanObserver(target: string): void {
    this.lastSomeBoolean = this.someBoolean;
  }

  lastSomeBoolean: boolean = true;

  @Attribute positiveBoolean = true;
}

@CustomElement("boolean-sub-component")
class BooleanSubComponent extends BooleanComponent {

  constructor() {
    super();
    console.log(`BooleanSubComponent exit`);
  }

  @Attribute someSubBoolean = false;
}


function someBooleanTest(guts: (bc: BooleanComponent, bsc: BooleanSubComponent) => void): void {
  const bc = <BooleanComponent> document.createElement("boolean-component");
  document.body.appendChild(bc);

  console.log(`Create Sub Component`);
  const bsc = <BooleanSubComponent> document.createElement("boolean-sub-component");
  console.log(`Create Sub Component done`);
  document.body.appendChild(bsc);
  try {
    guts(bc, bsc);
  } finally {
    bsc.parentElement.removeChild(bsc);
    bc.parentElement.removeChild(bc);
  }
}

it("Default false boolean attribute", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    assert.equal(bc.hasAttribute("some-boolean"), false);
    assert.equal(bc.getAttribute("some-boolean"), null);
    assert.equal(bc.someBoolean, false);
  });
});

it("(Subclass) Default false boolean attribute", function(): void {
  someBooleanTest((_: BooleanComponent, bsc: BooleanSubComponent): void => {
    assert.equal(bsc.hasAttribute("some-sub-boolean"), false);
    assert.equal(bsc.getAttribute("some-sub-boolean"), null);
    assert.equal(bsc.someSubBoolean, false);
  });
});

it("Default true boolean attribute", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    assert.equal(bc.hasAttribute("positive-boolean"), true);
    assert.notEqual(bc.getAttribute("positive-boolean"), null);
    assert.equal(bc.positiveBoolean, true);
  });
});

it("True boolean attribute via JS", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    bc.someBoolean = true;
    assert.equal(bc.hasAttribute("some-boolean"), true);
    assert.notEqual(bc.getAttribute("some-boolean"), null);
    assert.equal(bc.someBoolean, true);
  });
});

it("False boolean attribute via JS", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    bc.someBoolean = false;
    assert.equal(bc.hasAttribute("some-boolean"), false);
    assert.equal(bc.getAttribute("some-boolean"), null);
    assert.equal(bc.someBoolean, false);
  });
});

it("Boolean attribute via HTML", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    bc.removeAttribute("some-boolean");
    assert.equal(bc.hasAttribute("some-boolean"), false);
    assert.equal(bc.someBoolean, false);
    assert.equal(bc.getAttribute("some-boolean"), null);
  });
});

it("Set boolean attribute via HTML", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    bc.setAttribute("some-boolean", "");
    assert.equal(bc.hasAttribute("some-boolean"), true);
    assert.equal(bc.someBoolean, true);
    assert.notEqual(bc.getAttribute("some-boolean"), null);
  });
});

it("Boolean attribute toggle", function(): void {
  someBooleanTest((bc: BooleanComponent): void => {
    bc.removeAttribute("some-boolean");

    assert.equal(bc.hasAttribute("some-boolean"), false);
    assert.equal(bc.someBoolean, false);
    assert.equal(bc.getAttribute("some-boolean"), null);

    bc.setAttribute("some-boolean", "");
    assert.equal(bc.hasAttribute("some-boolean"), true);
    assert.equal(bc.someBoolean, true);
    assert.notEqual(bc.getAttribute("some-boolean"), null);

    assert.equal(typeof bc.lastSomeBoolean, "boolean");
    assert.equal(bc.lastSomeBoolean, true);
  });
});

/*

//-------------------------------------------------------------------------
// TODO should we support @Observe on attributes in the superclass?
@CustomElement("substring-component")
class SubStringComponent extends StringComponent {

  @Observe("someString")
  private _subSomeStringObserver(target: string): void {
    this.subLastSomeString = this.someString;
  }

  public subLastSomeString: string;
}

it("SubclassObserve", function(): void {
  const sc = <SubStringComponent> document.createElement("substring-component");
  document.body.appendChild(sc);
  sc.someString = "blah";
  assert.equal(sc.lastSomeString, "blah");
  assert.equal(sc.subLastSomeString, "blah");

}
*/

//-------------------------------------------------------------------------

@CustomElement("defaults-component")
class DefaultsComponent extends HTMLElement {

  @Attribute someString = "foo";
  @Attribute someNumber = 123;
  @Attribute someBoolean = false;
}

it("Defaults", function(): void {
  const ic = <DefaultsComponent> document.createElement("defaults-component");
  document.body.appendChild(ic);

  assert.equal(typeof ic.someString, "string");
  assert.equal(ic.someString, "foo");

  assert.equal(typeof ic.someNumber, "number");
  assert.equal(ic.someNumber, 123);

  assert.equal(typeof ic.someBoolean, "boolean");
  assert.equal(ic.someBoolean, false);
});

//-------------------------------------------------------------------------

@CustomElement("string-component-with-getter-setter")
class StringComponentWithGetterSetter extends HTMLElement {
  private _hiddenString = "";

  @Attribute get someString(): string {
    return this._hiddenString;
  }

  set someString(value: string) {
    this._hiddenString = value;
  }
}

function someStringComponentWithGetterSetterTest(guts: (sc: StringComponentWithGetterSetter) => void): void {
  const sc = <StringComponentWithGetterSetter> document.createElement("string-component-with-getter-setter");
  document.body.appendChild(sc);
  try {
    guts(sc);
  } finally {
    sc.parentElement.removeChild(sc);
  }
}

it("String with getter/setter", function(): void {
  someStringComponentWithGetterSetterTest((sc: StringComponentWithGetterSetter) => {
    sc.someString = "foo";
    assert.equal(sc.someString, "foo");
  });
});

it("String with getter/setter attribute", function(): void {
  someStringComponentWithGetterSetterTest((sc: StringComponentWithGetterSetter) => {
    sc.setAttribute("some-string", "foo");
    assert.equal(sc.someString, "foo");
  });
});

it("String with getter/setter attribute vs property", function(): void {
  someStringComponentWithGetterSetterTest((sc: StringComponentWithGetterSetter) => {
    sc.setAttribute("some-string", "foo");
    assert.equal(sc.someString, "foo");
  });
});

it("String with getter/setter attribute vs property 2", function(): void {
  someStringComponentWithGetterSetterTest((sc: StringComponentWithGetterSetter) => {
    sc.someString = "foo";
    assert.equal(sc.getAttribute("some-string"), "foo");
  });
});
