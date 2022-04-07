/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";

import { findAllURLs } from "./UrlRegex.js";

const TEST_ITEMS = [
  ["http://extraterm.org", "http://extraterm.org", 0],
  ["Go visit http://extraterm.org . It is great.", "http://extraterm.org", 9],
  ["Go visit http://extraterm.org/faq.html . It is great.", "http://extraterm.org/faq.html", 9],
  ["Go visit [Extraterm](http://extraterm.org).", "http://extraterm.org", 21],
  ["The website is here \"http://extraterm.org\" and \"click\" it.", "http://extraterm.org", 21],
  ["Go visit the website <http://extraterm.org>.", "http://extraterm.org", 22],
  ["Go visit this link [http://extraterm.org].", "http://extraterm.org", 20],
  ["The website is here \"http://extraterm.org and \"click\" it.", "http://extraterm.org", 21],
  ["The website is here \"http://extraterm.org", "http://extraterm.org", 21],
  ["The website is here [http://extraterm.org and \"click\" it.", "http://extraterm.org", 21],
  ["The website is here [http://extraterm.org", "http://extraterm.org", 21],
  ["The website is here (http://extraterm.org and github).", "http://extraterm.org", 21],
];

describe.each(TEST_ITEMS)("Extract cases", (line: string, url: string, index: number) => {
  test(`Scanning "${line}"`, done => {

    const allFound = findAllURLs(line);
    expect(allFound.length).toBe(1);
    expect(allFound[0][0]).toBe(url);
    expect(allFound[0].index).toBe(index);

    done();
  });
});

test("Multiple URLs in one line", done => {
  const allFound = findAllURLs("Here are two great sites: http://extraterm.org and http://github.com . Enjoy");
  expect(allFound.length).toBe(2);
  expect(allFound[0][0]).toBe("http://extraterm.org");
  expect(allFound[1][0]).toBe("http://github.com");
  done();
});
