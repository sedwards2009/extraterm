/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

const urlRegex = RegExp(
  "((?<![\"'<\\(\\[])(?<url>https?://\\S+))" + "|" +
  "\"(?<urlquoted>https?://[^\"]+?)\"" + "|" +
  "\\((?<urlbracketed>https?://[^\\)]+?)\\)" + "|" +
  "\\[(?<urlsquared>https?://[^\\]]+?)\\]" + "|" +
  "<(?<urlangled>https?://[^>]+?)>",
  "gi");

export interface URLMatch {
  index: number;
  0: string;
}

/**
 * Find all URLs in a string
 *
 * @param text string to search
 * @return list of matches
 *
 */
export function findAllURLs(text: string): URLMatch[] {
  const result: URLMatch[] = [];
  for (const m of text.matchAll(urlRegex)) {
    if (m.groups.url != null) {
      result.push({ index: m.index, 0: m.groups.url });

    } else if (m.groups.urlquoted != null) {
      result.push({ index: m.index + 1, 0: m.groups.urlquoted });

    } else if (m.groups.urlbracketed != null) {
      result.push({ index: m.index + 1, 0: m.groups.urlbracketed });

    } else if (m.groups.urlsquared != null) {
      result.push({ index: m.index + 1, 0: m.groups.urlsquared });

    } else if (m.groups.urlangled != null) {
      result.push({ index: m.index + 1, 0: m.groups.urlangled });
    }
  }
  return result;
}
