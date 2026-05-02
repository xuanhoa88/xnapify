/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { Button } from '@radix-ui/themes';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './CodeBlockView.css';

/**
 * CodeBlockView — Custom Tiptap NodeView for code blocks.
 *
 * Renders a header bar with:
 *  - Language label (left)  — shows node.attrs.language or "auto"
 *  - Copy button  (right) — copies code text to clipboard
 *
 * The actual editable code content is delegated to Tiptap via
 * `NodeViewContent`, preserving full editing + syntax highlighting.
 */
export default function CodeBlockView({ node }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  // Clean up copy-feedback timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const language = node.attrs.language || 'auto';

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(node.textContent)
      .then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard API may fail on non-HTTPS origins or denied permissions
      });
  }, [node.textContent]);

  return (
    <NodeViewWrapper className={s.codeBlockWrapper}>
      <div className={s.codeBlockHeader} contentEditable={false}>
        {/* Language label */}
        <span className={s.languageLabel}>{language}</span>

        {/* Copy button */}
        <Button
          variant='ghost'
          color='gray'
          size='1'
          className={clsx(s.copyButton, { [s.copied]: copied })}
          onClick={handleCopy}
          title={
            copied
              ? t('shared:form.wysiwyg.copied', 'Copied!')
              : t('shared:form.wysiwyg.copyCode', 'Copy code')
          }
        >
          <span className={s.copyIcon}>
            {copied ? (
              <CheckIcon width={16} height={16} />
            ) : (
              <CopyIcon width={16} height={16} />
            )}
          </span>
          {copied
            ? t('shared:form.wysiwyg.copied', 'Copied!')
            : t('shared:form.wysiwyg.copy', 'Copy')}
        </Button>
      </div>

      {/* Editable code content — Tiptap handles syntax highlighting here */}
      <div className={s.codeContent}>
        <NodeViewContent as='pre' />
      </div>
    </NodeViewWrapper>
  );
}

CodeBlockView.propTypes = {
  node: PropTypes.shape({
    attrs: PropTypes.shape({
      language: PropTypes.string,
    }),
    textContent: PropTypes.string,
  }).isRequired,
};
