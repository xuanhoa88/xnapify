/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useMemo, useRef } from 'react';

import hljs from 'highlight.js';
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
import mermaid from 'mermaid';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './MarkdownViewer.css';

import 'highlight.js/styles/github.css';

// Initialize mermaid for programmatic invocation
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
});

// Configure marked with highlight.js and custom renderers
const renderer = new marked.Renderer();

// Custom code renderer to emit mermaid blocks
const defaultCodeRenderer = renderer.code.bind(renderer);
renderer.code = function (code, language, isEscaped) {
  if (language === 'mermaid') {
    return `<div class="mermaid">${code}</div>`;
  }
  return defaultCodeRenderer(code, language, isEscaped);
};

// Custom blockquote renderer for GitHub Alerts
renderer.blockquote = function (quote) {
  const match = quote.match(/^<p>\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i);
  if (match) {
    const type = match[1].toLowerCase();
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    const cleaned = quote.replace(
      /^<p>\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\](?:<br>|\n|\s*)?/i,
      '<p>',
    );

    // Map types to explicit alert style classes to satisfy CSS Modules static analysis
    const alertClasses = {
      Note: s.alertNote,
      Warning: s.alertWarning,
      Important: s.alertImportant,
      Tip: s.alertTip,
      Caution: s.alertCaution,
    };
    const alertClass = alertClasses[typeCapitalized] || s.alertNote;

    return `<div class="${s.githubAlert} ${alertClass}">
              <div class="${s.alertTitle}">${typeCapitalized}</div>
              <div class="${s.alertBody}">${cleaned}</div>
            </div>`;
  }
  return `<blockquote>${quote}</blockquote>`;
};

marked.setOptions({
  renderer,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (_e) {
        // fall through to default
      }
    }
    return code;
  },
});

function MarkdownViewer({ context: { content = '', error = false } }) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);
  const articleRef = useRef(null);

  const htmlResult = useMemo(() => {
    if (error) return null;
    if (!content) return '';
    try {
      // 1. Strip YAML Frontmatter (e.g., --- \n id: overview \n ---)
      const cleanContent = content.replace(/^---\n[\s\S]+?\n---\n/, '');

      // 2. Parse Markdown to HTML
      const rawHtml = marked.parse(cleanContent);

      // 3. Enterprise-grade Sanitization (Permit class attributes for styling and mermaid)
      return DOMPurify.sanitize(rawHtml, {
        FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onclick'],
      });
    } catch {
      return `<p class="${s.errorText}">${t('viewer.parseError', 'Error parsing document.')}</p>`;
    }
  }, [content, error, t]);

  useEffect(() => {
    // 4. Safely invoke Mermaid rendering on parsed elements post-DOM-hydration
    if (htmlResult && articleRef.current) {
      try {
        // Run against specific internal nodes to prevent full document traversals
        mermaid
          .run({
            querySelector: '.mermaid',
            nodes: articleRef.current.querySelectorAll('.mermaid'),
            suppressErrors: true,
          })
          .catch(e => console.warn('Mermaid Error:', e));
      } catch (e) {
        // Suppress initial errors if SVG generation halts
      }
    }
  }, [htmlResult]);

  if (error) {
    return (
      <div className={s.container}>
        <div className={s.errorContainer}>
          <h2>{t('viewer.notFound', 'Document Not Found')}</h2>
          <p>
            {t(
              'viewer.notFoundDescription',
              'We could not locate the requested document at this path.',
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <article
        ref={articleRef}
        className={s.article}
        dangerouslySetInnerHTML={{ __html: htmlResult }}
      />
    </div>
  );
}

MarkdownViewer.propTypes = {
  context: PropTypes.shape({
    content: PropTypes.string,
    error: PropTypes.bool,
  }).isRequired,
};

export default MarkdownViewer;
