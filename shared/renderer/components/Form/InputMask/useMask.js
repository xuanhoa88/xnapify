/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useRef } from 'react';

// Default format characters for mask patterns
const FORMAT_CHARS = {
  9: /[0-9]/,
  a: /[A-Za-z]/,
  '*': /[A-Za-z0-9]/,
  s: /[a-z0-9-]/,
};

// ---------------------------------------------------------------------------
// Mask parsing
// ---------------------------------------------------------------------------

function parseMask(maskString) {
  if (!maskString) {
    return null;
  }

  const mask = [];
  const permanents = new Set();
  let isPermanent = false;

  maskString.split('').forEach(char => {
    if (!isPermanent && char === '\\') {
      isPermanent = true;
      return;
    }

    if (isPermanent || !FORMAT_CHARS[char]) {
      permanents.add(mask.length);
    }

    mask.push(isPermanent || !FORMAT_CHARS[char] ? char : FORMAT_CHARS[char]);
    isPermanent = false;
  });

  return { mask, permanents };
}

// ---------------------------------------------------------------------------
// Mask utilities (pure functions)
// ---------------------------------------------------------------------------

/**
 * Get the leading permanent characters (prefix) of a mask.
 */
function getPrefix(parsed) {
  let prefix = '';
  for (let i = 0; i < parsed.mask.length; i++) {
    if (parsed.permanents.has(i)) {
      prefix += parsed.mask[i];
    } else {
      break;
    }
  }
  return prefix;
}

/**
 * Format a raw input value against the mask using a Smart Jump algorithm.
 * Returns an object with the formatted string, a set of editable positions,
 * and a cursor map linking raw input indices to formatted output indices.
 */
function formatValue(parsed, raw, placeholderChar) {
  if (!parsed) return { value: raw, editables: new Set(), cursorMap: [] };

  const { mask, permanents } = parsed;
  const result = [];
  const editables = new Set();
  const cursorMap = new Array(raw.length + 1).fill(0);

  let rawIdx = 0;
  let i = 0;
  let lastMatched = -1;

  while (i < mask.length && rawIdx < raw.length) {
    // 1. Handle Permanent Characters
    if (permanents.has(i)) {
      result.push(mask[i]);
      if (raw[rawIdx] === mask[i]) {
        rawIdx++;
        lastMatched = i;
      }
      cursorMap[rawIdx] = result.length;
      i++;
      continue;
    }

    // 2. Handle Editable Characters
    const rule = mask[i];
    if (rule.test(raw[rawIdx])) {
      editables.add(result.length);
      result.push(raw[rawIdx]);
      rawIdx++;
      cursorMap[rawIdx] = result.length;
      lastMatched = i;
      i++;
    } else {
      // 3. Smart Jump: Raw char failed the rule.
      // Search ahead to see if they typed an upcoming permanent instead
      // (e.g., they typed a space to skip optional country code digits).
      let jumpTo = -1;
      for (let j = i + 1; j < mask.length; j++) {
        if (permanents.has(j) && mask[j] === raw[rawIdx]) {
          jumpTo = j;
          break;
        }
      }

      if (jumpTo !== -1) {
        if (placeholderChar) {
          // Fill skipped editables with the placeholder
          for (let k = i; k < jumpTo; k++) {
            if (!permanents.has(k)) {
              editables.add(result.length);
              result.push(placeholderChar);
            } else {
              result.push(mask[k]);
            }
          }
        }
        i = jumpTo;
      } else {
        // Did not match any upcoming permanent; discard invalid character
        rawIdx++;
        cursorMap[rawIdx] = result.length;
      }
    }
  }

  // Handle remaining mask sequence
  if (placeholderChar) {
    // Fill remaining positions with placeholders
    for (let k = i; k < mask.length; k++) {
      if (!permanents.has(k)) {
        editables.add(result.length);
        result.push(placeholderChar);
      } else {
        result.push(mask[k]);
      }
    }
    return { value: result.join(''), editables, cursorMap };
  }

  // Progressive Reveal Mode
  if (lastMatched < 0) {
    // Nothing valid typed yet, show only prefix
    return { value: getPrefix(parsed), editables: new Set(), cursorMap };
  }

  // Append trailing permanents up to the next editable character bounds
  let end = lastMatched + 1;
  while (end < mask.length && permanents.has(end)) {
    result.push(mask[end]);
    end++;
  }

  return { value: result.join(''), editables, cursorMap };
}

// ---------------------------------------------------------------------------
// useMask hook
// ---------------------------------------------------------------------------

export default function useMask({ mask, maskPlaceholder = '_' }) {
  const parsed = parseMask(mask);
  const inputRef = useRef(null);

  const setSelection = useCallback((input, start, end) => {
    if (!input) return;
    requestAnimationFrame(() => {
      if (input.setSelectionRange) {
        input.setSelectionRange(start, end != null ? end : start);
      }
    });
  }, []);

  const handleChange = useCallback(
    event => {
      if (!parsed) return;

      const input = event.target;
      const { selectionStart } = input;
      const rawInput = input.value;

      const { value: formatted, cursorMap } = formatValue(
        parsed,
        rawInput,
        maskPlaceholder,
      );

      input.value = formatted;

      // Position the cursor robustly using the cursor map
      let newCursor =
        cursorMap[selectionStart] !== undefined
          ? cursorMap[selectionStart]
          : formatted.length;
      setSelection(input, newCursor);
    },
    [parsed, maskPlaceholder, setSelection],
  );

  const handleFocus = useCallback(
    event => {
      if (!parsed) return;

      const input = event.target;

      if (!input.value) {
        const { value: defaultVal } = formatValue(parsed, '', maskPlaceholder);
        input.value = defaultVal;
      }

      setSelection(input, input.value.length);
    },
    [parsed, maskPlaceholder, setSelection],
  );

  const handleBlur = useCallback(
    event => {
      if (!parsed) return;

      const input = event.target;
      const { value, editables } = formatValue(
        parsed,
        input.value,
        maskPlaceholder,
      );

      // Check if any actual editable character exists
      const chars = value.split('');
      const hasContent = chars.some(
        (ch, i) =>
          editables.has(i) && ch !== maskPlaceholder && ch.trim() !== '',
      );

      if (!hasContent) {
        input.value = '';
      }
    },
    [parsed, maskPlaceholder],
  );

  const handleKeyDown = useCallback(
    event => {
      if (!parsed) return;

      const input = event.target;
      const { selectionStart, selectionEnd } = input;

      if (event.key === 'Backspace') {
        event.preventDefault();

        const { editables } = formatValue(parsed, input.value, maskPlaceholder);
        const chars = input.value.split('');
        let cursorTo = selectionStart;

        if (selectionStart !== selectionEnd) {
          // Range selection: clear editables in range
          for (let j = selectionStart; j < selectionEnd; j++) {
            if (editables.has(j)) {
              chars[j] = maskPlaceholder || '';
            }
          }
        } else if (selectionStart > 0) {
          // Single backspace: find previous editable
          let pos = selectionStart - 1;
          while (pos >= 0 && !editables.has(pos)) {
            // If they delete an auto-inserted trailing permanent, we allow deleting the editable before it
            if (pos === input.value.length - 1 && !maskPlaceholder) {
              chars[pos] = '';
            }
            pos--;
          }
          if (pos >= 0) {
            chars[pos] = maskPlaceholder || '';
            cursorTo = pos;
          } else {
            // Delete permanent prefix
            cursorTo = selectionStart - 1;
            if (!maskPlaceholder) chars[cursorTo] = '';
          }
        }

        const nextFormat = formatValue(parsed, chars.join(''), maskPlaceholder);
        input.value = nextFormat.value;
        setSelection(input, cursorTo);

        const nativeEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(nativeEvent);
      } else if (event.key === 'Delete') {
        event.preventDefault();

        const { editables } = formatValue(parsed, input.value, maskPlaceholder);
        const chars = input.value.split('');
        const cursorTo = selectionStart;

        if (selectionStart !== selectionEnd) {
          for (let j = selectionStart; j < selectionEnd; j++) {
            if (editables.has(j)) {
              chars[j] = maskPlaceholder || '';
            }
          }
        } else if (selectionStart < input.value.length) {
          let pos = selectionStart;
          while (pos < input.value.length && !editables.has(pos)) {
            pos++;
          }
          if (pos < input.value.length) {
            chars[pos] = maskPlaceholder || '';
          }
        }

        const nextFormat = formatValue(parsed, chars.join(''), maskPlaceholder);
        input.value = nextFormat.value;
        setSelection(input, cursorTo);

        const nativeEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(nativeEvent);
      }
    },
    [parsed, maskPlaceholder, setSelection],
  );

  // Initial render placeholder
  const initialPlaceholder = parsed
    ? formatValue(parsed, '', maskPlaceholder || '_').value
    : undefined;

  return {
    inputRef,
    maskHandlers: parsed
      ? {
          onChange: handleChange,
          onFocus: handleFocus,
          onBlur: handleBlur,
          onKeyDown: handleKeyDown,
        }
      : {},
    placeholder: initialPlaceholder,
  };
}
