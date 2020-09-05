import * as util from 'util';
import * as opentype from 'opentype.js';
import * as fontFinder from 'font-finder';
import * as lru from 'lru-cache';
import { CharCellGrid } from "extraterm-char-cell-grid";

import { Font, LigatureData, FlattenedLookupTree, LookupTree, Options } from './types';
import mergeTrees from './merge';
import walkTree from './walk';
import mergeRange from './mergeRange';

import buildTreeGsubType6Format1 from './processors/6-1';
import buildTreeGsubType6Format2 from './processors/6-2';
import buildTreeGsubType6Format3 from './processors/6-3';
import buildTreeGsubType8Format1 from './processors/8-1';
import flatten from './flatten';

class FontImpl implements Font {
  private _font: opentype.Font;
  private _lookupTrees: { tree: FlattenedLookupTree; processForward: boolean; }[] = [];
  private _glyphLookups = new Map<number, number[]>();
  private _cache?: lru.Cache<string, LigatureData | [number, number][]>;
  private _codePointToGlyphIndexCache = new Map<number, number>();

  constructor(font: opentype.Font, options: Required<Options>) {
    this._font = font;

    if (options.cacheSize > 0) {
      this._cache = lru({
        max: options.cacheSize,
        length: ((val: LigatureData | [number, number][], key: string) => key.length) as any
      });
    }

    const caltFeatures = this._font.tables.gsub.features.filter(f => f.tag === 'calt');
    const lookupIndices: number[] = caltFeatures
      .reduce((acc, val) => [...acc, ...val.feature.lookupListIndexes], []);
    const lookupGroups = this._font.tables.gsub.lookups
      .filter((l, i) => lookupIndices.some(idx => idx === i));

    const allLookups = this._font.tables.gsub.lookups;

    for (const [index, lookup] of lookupGroups.entries()) {
      const trees: LookupTree[] = [];
      switch (lookup.lookupType) {
        case 6:
          for (const [index, table] of lookup.subtables.entries()) {
            switch (table.substFormat) {
              case 1:
                trees.push(buildTreeGsubType6Format1(table, allLookups, index));
                break;
              case 2:
                trees.push(buildTreeGsubType6Format2(table, allLookups, index));
                break;
              case 3:
                trees.push(buildTreeGsubType6Format3(table, allLookups, index));
                break;
            }
          }
          break;
        case 8:
          for (const [index, table] of lookup.subtables.entries()) {
            trees.push(buildTreeGsubType8Format1(table, index));
          }
          break;
      }

      const tree = flatten(mergeTrees(trees));

      this._lookupTrees.push({
        tree,
        processForward: lookup.lookupType !== 8
      });

      for (const glyphId of tree.keys()) {
        if (!this._glyphLookups.get(glyphId)) {
          this._glyphLookups.set(glyphId, []);
        }

        this._glyphLookups.get(glyphId).push(index);
      }
    }
  }

  findLigatures(text: string): LigatureData {
    const cached = this._cache && this._cache.get(text);
    if (cached && !Array.isArray(cached)) {
      return cached;
    }

    const glyphIds: number[] = [];
    for (const char of text) {
      glyphIds.push(this._font.charToGlyphIndex(char));
    }

    // If there are no lookup groups, there's no point looking for
    // replacements. This gives us a minor performance boost for fonts with
    // no ligatures
    if (this._lookupTrees.length === 0) {
      return {
        inputGlyphs: glyphIds,
        outputGlyphs: glyphIds,
        contextRanges: []
      };
    }

    const result = this._findInternal(glyphIds.slice());
    const finalResult: LigatureData = {
      inputGlyphs: glyphIds,
      outputGlyphs: result.sequence,
      contextRanges: result.ranges
    };
    if (this._cache) {
      this._cache.set(text, finalResult);
    }

    return finalResult;
  }

  findLigatureRanges(text: string): [number, number][] {
    // Short circuit the process if there are no possible ligatures in the
    // font
    if (this._lookupTrees.length === 0) {
      return [];
    }

    const cached = this._cache && this._cache.get(text);
    if (cached) {
      return Array.isArray(cached) ? cached : cached.contextRanges;
    }

    const glyphIds: number[] = [];
    for (const char of text) {
      glyphIds.push(this._font.charToGlyphIndex(char));
    }

    const result = this._findInternal(glyphIds);
    if (this._cache) {
      this._cache.set(text, result.ranges);
    }

    return result.ranges;
  }

  private _findInternal(sequence: number[]): { sequence: number[]; ranges: [number, number][]; } {
    const ranges: [number, number][] = [];
    const orderedLookups = this._findRelevantLookupsForSequence(sequence);
    for (let orderedLookupIndex = 0; orderedLookupIndex < orderedLookups.length; orderedLookupIndex++) {
      this._applyLookupToSequence(orderedLookups[orderedLookupIndex], sequence, ranges);
    }

    return { sequence, ranges };
  }

  private _applyLookupToSequence(currentLookupIndex: number, sequence: number[], ranges: [number, number][]): void {
    const currentLookup = this._lookupTrees[currentLookupIndex];
    if (currentLookup.processForward) {
      this._applyLookupToSequenceForward(currentLookupIndex, sequence, ranges);
    } else {
      this._applyLookupToSequenceBackward(currentLookupIndex, sequence, ranges);
    }
  }

  private _applyLookupToSequenceForward(currentLookupIndex: number, sequence: number[], ranges: [number, number][]): void {
    const sequenceLength = sequence.length;
    const glyphLookups = this._glyphLookups;
    const currentLookup = this._lookupTrees[currentLookupIndex];

    for (let i = 0; i < sequenceLength; i++) {
      const currentLookups = glyphLookups.get(sequence[i]);
      if (currentLookups == null || currentLookups.indexOf(currentLookupIndex) === -1) {
        continue;
      }

      const result = walkTree(currentLookup.tree, sequence, i, i);
      if (result && this._applySubstitutionsToSequence(sequence, result.substitutions, i)) {
        mergeRange(ranges, result.contextRange[0] + i, result.contextRange[1] + i);
        i += result.length - 1;
      }
    }
  }

  private _applyLookupToSequenceBackward(currentLookupIndex: number, sequence: number[], ranges: [number, number][]): void {
    const sequenceLength = sequence.length;
    const glyphLookups = this._glyphLookups;
    const currentLookup = this._lookupTrees[currentLookupIndex];

    for (let i = sequenceLength - 1; i >= 0; i--) {
      const currentLookups = glyphLookups.get(sequence[i]);
      if (currentLookups == null || currentLookups.indexOf(currentLookupIndex) === -1) {
        continue;
      }

      const result = walkTree(currentLookup.tree, sequence, i, i);
      if (result && this._applySubstitutionsToSequence(sequence, result.substitutions, i)) {
        mergeRange(ranges, result.contextRange[0] + i, result.contextRange[1] + i);
        i -= result.length - 1;
      }
    }
  }

  private _findRelevantLookupsForSequence(sequence: number[]): number[] {
    // Determine which lookups we should examine.
    const glyphLookups = this._glyphLookups;
    const sequenceLength = sequence.length;
    const seenLookups = new Set<number>();
    for (let i = 0; i < sequenceLength; i++) {
      const lookups = glyphLookups.get(sequence[i]);
      if (lookups != null) {
        for (let j = 0; j < lookups.length; j++) {
          seenLookups.add(lookups[j]);
        }
      }
    }

    const orderedLookups = Array.from(seenLookups);
    orderedLookups.sort();
    return orderedLookups;
  }

  private _applySubstitutionsToSequence(sequence: number[], substitutions: number[], startIndex: number): boolean {
    let didSubstitute = false;
    for (let j = 0; j < substitutions.length; j++) {
      const sub = substitutions[j];
      if (sub !== null) {
        sequence[startIndex + j] = sub;
        didSubstitute = true;
      }
    }
    return didSubstitute;
  }

  markLigaturesCharCellGridRow(grid: CharCellGrid, row: number): void {
    // Short circuit the process if there are no possible ligatures in the
    // font
    if (this._lookupTrees.length === 0) {
      return;
    }

    const glyphIds = this._findGlyphIdsInCharCellGridRow(grid, row);

    const width = grid.width;
    const result = this._findInternal(glyphIds);
    let i = 0;
    for (const range of result.ranges) {
      while (i < range[0]) {
        grid.setLigature(i, row, 0);
        i++;
      }
      const ligatureLength = range[1] - range[0];
      grid.setLigature(range[0], row, ligatureLength);
      i += ligatureLength;
    }

    while (i < width) {
      grid.setLigature(i, row, 0);
      i++;
    }
  }

  private _findGlyphIdsInCharCellGridRow(grid: CharCellGrid, row: number): number [] {
    const glyphIds: number[] = [];
    const width = grid.width;
    for (let i = 0; i < width; i++) {
      const codePoint = grid.getCodePoint(i, row);
      let glyphIndex = this._codePointToGlyphIndexCache.get(codePoint);
      if (glyphIndex === undefined) {
        const char = String.fromCodePoint(codePoint);
        glyphIndex = this._font.charToGlyphIndex(char);
        this._codePointToGlyphIndexCache.set(codePoint, glyphIndex);
      }
      glyphIds.push(glyphIndex);
    }
    return glyphIds;
  }
}

/**
 * Load the font with the given name. The returned value can be used to find
 * ligatures for the font.
 *
 * @param name Font family name for the font to load
 */
export async function load(name: string, options?: Options): Promise<Font> {
  // We just grab the first font variant we find for now.
  // TODO: allow users to specify information to pick a specific variant
  const [fontInfo] = await fontFinder.listVariants(name);

  if (!fontInfo) {
    throw new Error(`Font ${name} not found`);
  }

  return loadFile(fontInfo.path, options);
}

/**
 * Load the font at the given file path. The returned value can be used to find
 * ligatures for the font.
 *
 * @param path Path to the file containing the font
 */
export async function loadFile(path: string, options?: Options): Promise<Font> {
  const font = await util.promisify<string, opentype.Font>(opentype.load as any)(path);
  return new FontImpl(font, {
    cacheSize: 0,
    ...options
  });
}

export { Font, LigatureData, Options };
