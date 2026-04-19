/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import { Button } from '@radix-ui/themes';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import Icon from '../Icon';

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
  const [copied, setCopied] = useState(false);

  const language = node.attrs.language || 'auto';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(node.textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          title={copied ? 'Copied!' : 'Copy code'}
        >
          <span className={s.copyIcon}>
            {copied ? (
              <Icon name='check' size={16} strokeWidth={2.5} />
            ) : (
              <Icon name='copy' size={16} strokeWidth={2.5} />
            )}
          </span>
          {copied ? 'Copied!' : 'Copy'}
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
