import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordCues } from '../src/ai/cues.js';
import { CORPUS } from './corpus.js';

test('rule cues: no false flags on precise answers (precision protects the expert\'s patience)', () => {
  const noisy = CORPUS.filter((c) => c.none && keywordCues(c.a).length);
  assert.deepEqual(noisy.map((c) => c.a), []);
});

test('rule cues: catch the expected implicit knowledge', () => {
  const missed = CORPUS.filter((c) => c.expect?.length && !keywordCues(c.a).some((x) => c.expect.includes(x.type)));
  assert.deepEqual(missed.map((c) => c.a), []);
});

test('rule cues: everyday phrases are not flagged', () => {
  for (const s of ['I feel like everyone likes it.', 'It looks like rain today.', 'We feel happy making it.', 'About 2 spoons.']) {
    assert.deepEqual(keywordCues(s), [], s);
  }
});
