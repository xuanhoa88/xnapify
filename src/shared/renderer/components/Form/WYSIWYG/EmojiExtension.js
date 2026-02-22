/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Extension, textInputRule } from '@tiptap/core';

/**
 * A lightweight custom Emoji extension that uses ProseMirror's textInputRules
 * to convert common text emoticons and shortcodes to native Unicode emojis on the fly.
 */
export const Emoji = Extension.create({
  name: 'emojiNative',

  addInputRules() {
    return [
      // Basic Emoticons
      textInputRule({
        find: /(?:^|\s)(:-?\)) $/,
        replace: '🙂',
      }),
      textInputRule({
        find: /(?:^|\s)(;-?\)) $/,
        replace: '😉',
      }),
      textInputRule({
        find: /(?:^|\s)(:-?D) $/,
        replace: '😃',
      }),
      textInputRule({
        find: /(?:^|\s)(:-?\() $/,
        replace: '🙁',
      }),
      textInputRule({
        find: /(?:^|\s)(:-?[pP]) $/,
        replace: '😛',
      }),
      textInputRule({
        find: /(?:^|\s)(:-?[oO]) $/,
        replace: '😮',
      }),
      textInputRule({
        find: /(?:^|\s)(:-?\|) $/,
        replace: '😐',
      }),
      textInputRule({
        find: /(?:^|\s)(<3) $/,
        replace: '❤️',
      }),
      textInputRule({
        find: /(?:^|\s)(<\/?3) $/,
        replace: '💔',
      }),

      // Common Shortcodes
      textInputRule({
        find: /(?:^|\s)(:smile:) $/,
        replace: '😄',
      }),
      textInputRule({
        find: /(?:^|\s)(:laughing:) $/,
        replace: '😆',
      }),
      textInputRule({
        find: /(?:^|\s)(:joy:) $/,
        replace: '😂',
      }),
      textInputRule({
        find: /(?:^|\s)(:rofl:) $/,
        replace: '🤣',
      }),
      textInputRule({
        find: /(?:^|\s)(:sunglasses:) $/,
        replace: '😎',
      }),
      textInputRule({
        find: /(?:^|\s)(:heart_eyes:) $/,
        replace: '😍',
      }),
      textInputRule({
        find: /(?:^|\s)(:thumbsup:|:\+1:) $/,
        replace: '👍',
      }),
      textInputRule({
        find: /(?:^|\s)(:thumbsdown:|:-1:) $/,
        replace: '👎',
      }),
      textInputRule({
        find: /(?:^|\s)(:pray:) $/,
        replace: '🙏',
      }),
      textInputRule({
        find: /(?:^|\s)(:clap:) $/,
        replace: '👏',
      }),
      textInputRule({
        find: /(?:^|\s)(:fire:) $/,
        replace: '🔥',
      }),
      textInputRule({
        find: /(?:^|\s)(:100:) $/,
        replace: '💯',
      }),
      textInputRule({
        find: /(?:^|\s)(:sparkles:) $/,
        replace: '✨',
      }),
      textInputRule({
        find: /(?:^|\s)(:star:) $/,
        replace: '⭐',
      }),
      textInputRule({
        find: /(?:^|\s)(:check:) $/,
        replace: '✅',
      }),
      textInputRule({
        find: /(?:^|\s)(:x:) $/,
        replace: '❌',
      }),
      textInputRule({
        find: /(?:^|\s)(:warning:) $/,
        replace: '⚠️',
      }),
      textInputRule({
        find: /(?:^|\s)(:rocket:) $/,
        replace: '🚀',
      }),
      textInputRule({
        find: /(?:^|\s)(:eyes:) $/,
        replace: '👀',
      }),
    ];
  },
});
