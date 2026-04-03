/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Text Processing Worker — Utility functions for CPU-bound text tasks.
 *
 * Each named export is a standalone async/sync function called directly.
 * Workers receive a SINGLE data argument and must return serializable results.
 */

import crypto from 'crypto';

/** Marks this worker as eligible for thread pool execution. */
export const THREADED = true;

/**
 * Count words, characters, lines, and sentences in a text body.
 *
 * @param {{ text: string }} data
 * @returns {{ words: number, characters: number, lines: number, sentences: number }}
 */
export function countStats(data) {
  const { text } = data;
  if (!text || typeof text !== 'string') {
    return { words: 0, characters: 0, lines: 0, sentences: 0 };
  }

  const words = text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  const characters = text.length;
  const lines = text.split('\n').length;
  const sentences = text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 0).length;

  return { words, characters, lines, sentences };
}

/**
 * Compute SHA-256 hash of a text string.
 * Demonstrates a CPU-bound crypto operation.
 *
 * @param {{ text: string, algorithm?: string }} data
 * @returns {{ hash: string, algorithm: string }}
 */
export function hashText(data) {
  const { text, algorithm } = data;
  const algo = algorithm || 'sha256';
  const hash = crypto
    .createHash(algo)
    .update(text || '')
    .digest('hex');
  return { hash, algorithm: algo };
}

/**
 * Find all occurrences of a pattern in text.
 *
 * @param {{ text: string, pattern: string, caseSensitive?: boolean }} data
 * @returns {{ matches: Array<{ index: number, match: string }>, count: number }}
 */
export function findPattern(data) {
  const { text, pattern, caseSensitive } = data;
  if (!text || !pattern) {
    return { matches: [], count: 0 };
  }

  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(pattern, flags);
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, match: match[0] });
  }

  return { matches, count: matches.length };
}
