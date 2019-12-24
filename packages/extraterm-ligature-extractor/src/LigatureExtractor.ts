/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import * as fontLigatures from 'font-ligatures';
import { FlattenedLookupTree } from 'font-ligatures/dist/types';


export async function extractLigaturesFromFile(filename: string): Promise<string[]> {
  const font: any = await fontLigatures.loadFile(filename);
  const opentypeFont = font._font;

  const lookupTrees: { tree: FlattenedLookupTree; processForward: boolean; }[] = font._lookupTrees;

  let result: string[] = [];
  for (const treeRootEntry of lookupTrees) {
    result = result.concat(getCombinationsFromTree(treeRootEntry.tree, opentypeFont));
  }
  return result;
}

function getCombinationsFromTree(treeEntry: FlattenedLookupTree, opentypeFont): string[] {
  let resultList: string[] = [];
  for (const glyphKey of Object.keys(treeEntry)) {
    const codePoint = opentypeFont.glyphs.get(glyphKey).unicode;
    if (codePoint === undefined || Number.isNaN(codePoint)) {
      continue;
    }

    const char = String.fromCodePoint(codePoint);
    const subTree = treeEntry[glyphKey];
    if (subTree.forward != null) {
      if (subTree.lookup != null) {
        resultList.push(char);
      }
      resultList = resultList.concat(getCombinationsFromTree(subTree.forward, opentypeFont).map(s => char + s));
    }
  }
  return resultList;
}
