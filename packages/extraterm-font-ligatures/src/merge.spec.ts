import test, { GenericTestContext, Context } from 'ava';

import mergeTrees from './merge';
import { LookupResult, LookupTreeEntry, LookupTree } from './types';

function lookup(substitutionGlyph: number, index?: number, subIndex?: number): LookupResult {
    return {
        contextRange: [0, 1],
        index: index || 0,
        subIndex: subIndex || 0,
        length: 1,
        substitutions: [substitutionGlyph]
    };
}

function lookupTreeEquals(t: GenericTestContext<Context<any>>, a: LookupTree, b: LookupTree): void {
    t.true((a == null) == (b == null));
    if (a == null) {
        return;
    }

    mapDeepEquals(t, a.individual, b.individual);
    t.deepEqual(a.range, b.range);
}

function lookupTreeListEquals(t: GenericTestContext<Context<any>>, a: LookupTree[], b: LookupTree[]): void {
    t.true((a == null) == (b == null));
    if (a == null) {
        return;
    }

    for (let i=0; i<a.length; i++) {
        lookupTreeEquals(t, a[i], b[i]);
    }
}

function mapDeepEquals(t: GenericTestContext<Context<any>>, a: Map<any, any>, b: Map<any, any>): void {
    t.true((a == null) == (b == null));
    if (a == null) {
        return;
    }

    const aKeys = Array.from(a.keys());
    aKeys.sort();
    const bKeys = Array.from(b.keys());
    bKeys.sort();
    t.deepEqual(aKeys, bKeys);

    for (let i=0; i<aKeys.length; i++) {
        t.deepEqual(a.get(aKeys[i]), b.get(bKeys[i]));
    }
}


test('combines disjoint trees', t => {
    const result = mergeTrees([
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(1) }],
            ]),
            range: []
        },
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(2) },
                range: [2, 4]
            }]
        },
        {
            individual: new Map<number, LookupTreeEntry>([
                [5, { lookup: lookup(3) }],
            ]),
            range: []
        },
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(4) },
                range: [8, 10]
            }]
        }
    ]);

    lookupTreeEquals(t, result, {
        individual: new Map<number, LookupTreeEntry>([
            [1, { lookup: lookup(1) }],
            [5, { lookup: lookup(3) }],
        ]),
        range: [{
            entry: { lookup: lookup(2) },
            range: [2, 4]
        }, {
            entry: { lookup: lookup(4) },
            range: [8, 10]
        }]
    });
});

test('merges matching individual glyphs', t => {
    const result = mergeTrees([
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(1, 1) }]
            ]),
            range: []
        },
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(2, 0) }]
            ]),
            range: []
        },
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(3, 2) }]
            ]),
            range: []
        }
    ]);

    lookupTreeEquals(t, result, {
        individual: new Map<number, LookupTreeEntry>([
            [1, { lookup: lookup(2, 0) }]
        ]),
        range: []
    });
});

test('merges range glyphs overlapping individual glyphs', t => {
    const result = mergeTrees([
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(1, 0) }]
            ]),
            range: []
        },
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(2, 1) },
                range: [0, 4]
            }]
        }
    ]);

    lookupTreeEquals(t, result, {
        individual: new Map<number, LookupTreeEntry>([
            [0, { lookup: lookup(2, 1) }],
            [1, { lookup: lookup(1, 0) }]
        ]),
        range: [{
            entry: { lookup: lookup(2, 1) },
            range: [2, 4]
        }]
    });
});

test('merges individual glyphs overlapping range glyphs', t => {
    const result = mergeTrees([
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(2, 1) },
                range: [0, 4]
            }]
        },
        {
            individual: new Map<number, LookupTreeEntry>([
                [1, { lookup: lookup(1, 0) }]
            ]),
            range: []
        }
    ]);

    lookupTreeEquals(t, result, {
        individual: new Map<number, LookupTreeEntry>([
            [0, { lookup: lookup(2, 1) }],
            [1, { lookup: lookup(1, 0) }]
        ]),
        range: [{
            entry: { lookup: lookup(2, 1) },
            range: [2, 4]
        }]
    });
});

test('merges multiple overlapping ranges', t => {
    const result = mergeTrees([
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(1, 2) },
                range: [0, 3]
            }, {
                entry: { lookup: lookup(2, 1) },
                range: [6, 12]
            }, {
                entry: { lookup: lookup(5, 3) },
                range: [15, 20]
            }, {
                entry: { lookup: lookup(7, 4) },
                range: [20, 22]
            }]
        },
        {
            individual: new Map<number, LookupTreeEntry>(),
            range: [{
                entry: { lookup: lookup(3, 0) },
                range: [2, 8]
            }, {
                entry: { lookup: lookup(4, 0) },
                range: [10, 13]
            }, {
                entry: { lookup: lookup(6, 0) },
                range: [16, 21]
            }]
        }
    ]);

    lookupTreeEquals(t, result, {
        individual: new Map<number, LookupTreeEntry>([
            [2, { lookup: lookup(3, 0) }],
            [12, { lookup: lookup(4, 0) }],
            [15, { lookup: lookup(5, 3) }],
            [20, { lookup: lookup(6, 0) }],
            [21, { lookup: lookup(7, 4) }]
        ]),
        range: [{
            entry: { lookup: lookup(1, 2) },
            range: [0, 2]
        }, {
            entry: { lookup: lookup(3, 0) },
            range: [6, 8]
        }, {
            entry: { lookup: lookup(3, 0) },
            range: [3, 6]
        }, {
            entry: { lookup: lookup(2, 1) },
            range: [8, 10]
        }, {
            entry: { lookup: lookup(4, 0) },
            range: [10, 12]
        }, {
            entry: { lookup: lookup(6, 0) },
            range: [16, 20]
        }]
    });
});
