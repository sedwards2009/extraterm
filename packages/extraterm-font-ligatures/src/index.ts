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

        let nextLookup = this._getNextLookup(sequence, 0);
        while (nextLookup.index !== null) {
            const lookup = this._lookupTrees[nextLookup.index];
            if (lookup.processForward) {
                let lastGlyphIndex = nextLookup.last;
                for (let i = nextLookup.first; i < lastGlyphIndex; i++) {
                    const result = walkTree(lookup.tree, sequence, i, i);
                    if (result) {
                        let didSubstitute = false;
                        for (let j = 0; j < result.substitutions.length; j++) {
                            const sub = result.substitutions[j];
                            if (sub !== null) {
                                sequence[i + j] = sub;
                                didSubstitute = true;
                            }
                        }
                        if (didSubstitute) {
                            mergeRange(
                                ranges,
                                result.contextRange[0] + i,
                                result.contextRange[1] + i
                            );

                            // Substitutions can end up extending the search range
                            if (i + result.length >= lastGlyphIndex) {
                                lastGlyphIndex = i + result.length + 1;
                            }
                        }
                        i += result.length - 1;
                    }
                }
            } else {
                // We don't need to do the lastGlyphIndex tracking here because
                // reverse processing isn't allowed to replace more than one
                // character at a time.
                for (let i = nextLookup.last - 1; i >= nextLookup.first; i--) {
                    const result = walkTree(lookup.tree, sequence, i, i);
                    if (result) {
                        for (let j = 0; j < result.substitutions.length; j++) {
                            const sub = result.substitutions[j];
                            if (sub !== null) {
                                sequence[i + j] = sub;
                            }
                        }

                        mergeRange(
                            ranges,
                            result.contextRange[0] + i,
                            result.contextRange[1] + i
                        );

                        i -= result.length - 1;
                    }
                }
            }

            nextLookup = this._getNextLookup(sequence, nextLookup.index + 1);
        }

        return { sequence, ranges };
    }

    /**
     * Returns the lookup and glyph range for the first lookup that might
     * contain a match.
     *
     * @param sequence Input glyph sequence
     * @param start The first input to try
     */
    private _getNextLookup(sequence: number[], start: number): { index: number | null; first: number; last: number; } {
        const result: { index: number | null; first: number; last: number; } = {
            index: null,
            first: Infinity,
            last: -1
        };
        const glyphLookups = this._glyphLookups;

        // Loop through each glyph and find the first valid lookup for it
        for (let i = 0; i < sequence.length; i++) {
            const lookups = glyphLookups.get(sequence[i]);
            if (!lookups) {
                continue;
            }

            for (let j = 0; j < lookups.length; j++) {
                const lookupIndex = lookups[j];
                if (lookupIndex >= start) {
                    // Update the lookup information if it's the one we're
                    // storing or earlier than it.
                    if (result.index === null || lookupIndex <= result.index) {
                        result.index = lookupIndex;

                        if (result.first > i) {
                            result.first = i;
                        }

                        result.last = i + 1;
                    }

                    break;
                }
            }
        }

        return result;
    }

    markLigaturesCharCellGridRow(grid: CharCellGrid, row: number): void {
        // Short circuit the process if there are no possible ligatures in the
        // font
        if (this._lookupTrees.length === 0) {
            return;
        }

        const glyphIds: number[] = [];
        const width = grid.width;
        for (let i=0; i<width; i++) {
            const codePoint = grid.getCodePoint(i, row);
            let glyphIndex = this._codePointToGlyphIndexCache.get(codePoint);
            if (glyphIndex === undefined) {
                const char = String.fromCodePoint(codePoint);
                glyphIndex = this._font.charToGlyphIndex(char);
                this._codePointToGlyphIndexCache.set(codePoint, glyphIndex);
            }
            glyphIds.push(glyphIndex);
        }

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
