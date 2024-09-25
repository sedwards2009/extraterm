/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
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

function score(searchText: string, candidate: string): ScoreResult {
  const score = bestFitMatchTest(searchText, candidate);
  if (score != null) {
    return {
      score: 0,
      score2: score.score2,
      matchRanges: score.matchRanges
    };
  }

  return {
    score: 1,
    score2: 0,
    matchRanges: []
  };
}

const RANGE_PENALTY = 1000;
const WORD_START_BONUS = -10;
const INEXACT_MATCH_PENALTY = 10;

export function bestFitMatchTest(searchString: string, text: string): TestResult {
  const searchStringLower = searchString.toLowerCase();
  const textLower = text.toLowerCase();

  let searchIndex =0;
  let textIndex = 0;
  const searchStringLen = searchString.length;
  const textLen = textLower.length;

  const matchRanges: MatchRange[] = [];

  let matchStart = -1;
  while (searchIndex < searchStringLen && textIndex < textLen) {
    if (matchStart === -1) {
      // We are looking for the start of a match.
      if (searchStringLower[searchIndex] === textLower[textIndex]) {
        matchStart = textIndex;
        searchIndex++;
      }
    } else {
      // We are in the middle of a match.
      if (searchStringLower[searchIndex] === textLower[textIndex]) {
        searchIndex++;
      } else {
        // We reached the end of the match.
        matchRanges.push({
          start: matchStart,
          stop: textIndex
        });
        matchStart = -1;
      }
    }
    textIndex++;
  }

  if (searchIndex < searchStringLen) {
    return null;
  }

  if (matchStart !== -1) {
    matchRanges.push({
      start: matchStart,
      stop: textIndex
    });
  }

  // Score the result
  if (matchRanges.length === 0) {
    return null;
  }

  let searchIndex2 = 0;
  let inexactMatchesCount = 0;
  let wordStartBonus = 0;
  for (const range of matchRanges) {

    if (range.start === 0) {
      wordStartBonus++;
    } else {
      const prevChar = text[range.start - 1];
      if (prevChar === ' ' || prevChar === '_' || prevChar === '-') {
        wordStartBonus++;
      }
    }

    for (let i=range.start; i<range.stop; i++) {
      if (text[i] !== searchString[searchIndex2]) {
        inexactMatchesCount++;
      }
      searchIndex2++;
    }
  }

  return {
    score2: (RANGE_PENALTY * matchRanges.length +
      matchRanges[0].start +
      INEXACT_MATCH_PENALTY * inexactMatchesCount +
      WORD_START_BONUS * wordStartBonus),
    matchRanges
  };
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
