/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Extension, textInputRule } from '@tiptap/core';
import { EMOJI_DICTIONARY } from './constants';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export const Emoji = Extension.create({
  name: 'emoji',

  addInputRules() {
    const rules = [];

    Object.entries(EMOJI_DICTIONARY).forEach(([shortcode, emoji]) => {
      // Only create input rules for strings that are actually shortcodes/emoticons
      // (not the raw emojis that we added just to populate the grid list)
      if (shortcode === emoji) return;

      rules.push(
        textInputRule({
          find: new RegExp(`(?:^|\\s)(${escapeRegExp(shortcode)}) $`),
          replace: emoji,
        }),
      );
    });

    return rules;
  },
});
