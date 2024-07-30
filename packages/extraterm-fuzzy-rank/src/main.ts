/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface MatchRange {
  start: number;
  stop: number;
}

export interface MatchResult {
  index: number;
  text: string;
  score: number;
  score2: number;
  score3: number;
  matchRanges: MatchRange[];
}

export function matchList(searchText: string, candidates: string[]): MatchResult[] {
  return candidates.map((c, index) => {
    const scoreResult = score(searchText, c);
    return {
      index,
      text: c,
      score: scoreResult.score,
      score2: scoreResult.score2,
      score3: index,
      matchRanges: scoreResult.matchRanges
    };
  });
}

export function rankList(searchText: string, candidates: string[]): MatchResult[] {
  const scoresList = matchList(searchText, candidates);
  scoresList.sort(cmp);
  return scoresList;
}

function cmp(a: MatchResult, b: MatchResult): number {
  if (a.score < b.score) {
    return -1;
  }
  if (b.score < a.score) {
    return 1;
  }

  if (a.score2 < b.score2) {
    return -1;
  }
  if (b.score2 < a.score2) {
    return 1;
  }

  if (a.score3 < b.score3) {
    return -1;
  }
  if (b.score3 < a.score3) {
    return 1;
  }
  return 0;
}

interface ScoreResult {
  score: number;
  score2: number;
  matchRanges: MatchRange[];
}

interface TestResult {
  score2: number;
  matchRanges: MatchRange[];
}

type TestFunc = (searchText: string, candidate: string) => TestResult;

const testFuncs: TestFunc[] = [
  exactMatchTest,
  exactCaseInsensitiveMatchText,
  firstWordMatchTest,
  firstWordCaseInsensitiveMatchTest,
  wordMatchTest,
  wordCaseInsensitiveMatchTest,
  substringMatchTest,
  substringCaseInsensitiveMatchTest
];

function score(searchText: string, candidate: string): ScoreResult {
  for (let i=0; i<testFuncs.length; i++) {
    const score = testFuncs[i](searchText, candidate);
    if (score != null) {
      return {
        score: i,
        score2: score.score2,
        matchRanges: score.matchRanges
      };
    }
  }

  return {
    score: testFuncs.length,
    score2: 0,
    matchRanges: []
  };
}

function exactMatchTest(searchText: string, candidate: string): TestResult {
  if (searchText === candidate) {
    return {
      score2: 0,
      matchRanges: [
        {
          start: 0,
          stop: candidate.length
        }
      ]
    };
  }
  return null;
}

function exactCaseInsensitiveMatchText(searchText: string, candidate: string): TestResult {
  if (searchText.toLowerCase() === candidate.toLowerCase()) {
    return {
      score2: 0,
      matchRanges: [
        {
          start: 0,
          stop: searchText.length
        }
      ]
    };
  }
  return null;
}

const wordSplitRegexp = /[ _-]/g;

function firstWordMatchTest(searchText: string, candidate: string): TestResult {
  const words = candidate.split(wordSplitRegexp);
  if (words[0] === searchText) {
    return {
      score2: 0,
      matchRanges: [
        {
          start: 0,
          stop: words[0].length
        }
      ]
    };
  }
  return null;
}

function firstWordCaseInsensitiveMatchTest(searchText: string, candidate: string): TestResult {
  const words = candidate.split(wordSplitRegexp);
  if (words[0].toLowerCase() === searchText.toLowerCase()) {
    return {
      score2: 0,
      matchRanges: [
        {
          start: 0,
          stop: words[0].length
        }
      ]
    };
  }
  return null;
}

function wordMatchTest(searchText: string, candidate: string): TestResult {
  const words = candidate.split(wordSplitRegexp);
  const index = words.indexOf(searchText);
  if (index !== -1) {
    let offset = 0;
    for (let i=0; i<index; i++) {
      offset += words[i].length + 1;
    }
    return {
      score2: 0,
      matchRanges: [
        {
          start: offset,
          stop: offset + searchText.length
        }
      ]
    };
  }
  return null;
}

function wordCaseInsensitiveMatchTest(searchText: string, candidate: string): TestResult {
  const words = candidate.toLowerCase().split(wordSplitRegexp);
  const index = words.indexOf(searchText.toLowerCase());
  if (index !== -1) {
    let offset = 0;
    for (let i=0; i<index; i++) {
      offset += words[i].length + 1;
    }
    return {
      score2: 0,
      matchRanges: [
        {
          start: offset,
          stop: offset + searchText.length
        }
      ]
    };
  }
  return null;
}

function substringMatchTest(searchText: string, candidate: string): TestResult {
  const index = candidate.indexOf(searchText);
  if (index !== -1) {
    return {
      score2: index,
      matchRanges: [
        {
          start: index,
          stop: index + searchText.length
        }
      ]
    };
  }
  return null;
}

function substringCaseInsensitiveMatchTest(searchText: string, candidate: string): TestResult {
  const index = candidate.toLowerCase().indexOf(searchText.toLowerCase());
  if (index !== -1) {
    return {
      score2: index,
      matchRanges: [
        {
          start: index,
          stop: index + searchText.length
        }
      ]
    };
  }
  return null;
}

export interface SurroundOptions {
  ranges: MatchRange[];
  prefix: string;
  suffix: string;
}

export function surround(str: string, options: SurroundOptions): string {
  for (let i=options.ranges.length-1; i>=0; i--) {
    str = surroundOne(str, options.ranges[i], options.prefix, options.suffix);
  }
  return str;
}

function surroundOne(str: string, range: MatchRange, prefix: string, suffix: string): string {
  return str.substring(0, range.start) + prefix + str.substring(range.start, range.stop) + suffix + str.substring(range.stop);
}
