import test from 'ava';

import mergeRange from './mergeRange';

test('inserts a new range before the existing ones', t => {
    const result = mergeRange([[1, 2], [2, 3]], 0, 1);
    t.deepEqual(result, [[0, 1], [1, 2], [2, 3]]);
});

test('inserts in between two ranges', t => {
    const result = mergeRange([[0, 2], [4, 6]], 2, 4);
    t.deepEqual(result, [[0, 2], [2, 4], [4, 6]]);
});

test('inserts after the last range', t => {
    const result = mergeRange([[0, 2], [4, 6]], 6, 8);
    t.deepEqual(result, [[0, 2], [4, 6], [6, 8]]);
});

test('extends the beginning of a range', t => {
    const result = mergeRange([[0, 2], [4, 6]], 3, 5);
    t.deepEqual(result, [[0, 2], [3, 6]]);
});

test('extends the end of a range', t => {
    const result = mergeRange([[0, 2], [4, 6]], 1, 4);
    t.deepEqual(result, [[0, 4], [4, 6]]);
});

test('extends the last range', t => {
    const result = mergeRange([[0, 2], [4, 6]], 5, 7);
    t.deepEqual(result, [[0, 2], [4, 7]]);
});

test('connects two ranges', t => {
    const result = mergeRange([[0, 2], [4, 6]], 1, 5);
    t.deepEqual(result, [[0, 6]]);
});

test('connects more than two ranges', t => {
    const result = mergeRange([[0, 2], [4, 6], [8, 10], [12, 14]], 1, 10);
    t.deepEqual(result, [[0, 10], [12, 14]]);
});
