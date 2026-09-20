import test from 'node:test';
import assert from 'node:assert/strict';
import { extractUsername } from '../src/utils/githubActivity.js';
import { getStorageApi, checkHasChromeStorage } from '../src/utils/storage.js';

test('extractUsername extracts valid handles from various input formats', () => {
  assert.equal(extractUsername('poorvith-mp'), 'poorvith-mp');
  assert.equal(extractUsername('@poorvith-mp'), 'poorvith-mp');
  assert.equal(extractUsername('https://github.com/poorvith-mp'), 'poorvith-mp');
  assert.equal(extractUsername('github.com/poorvith-mp/'), 'poorvith-mp');
  assert.equal(extractUsername(''), '');
});

test('getStorageApi falls back to null when chrome/browser extensions are absent', () => {
  assert.equal(getStorageApi(), null);
  assert.equal(checkHasChromeStorage(), false);
});
