/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import hljs from 'highlight.js';
import { marked } from 'marked';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './MarkdownViewer.css';

import 'highlight.js/styles/github.css';

// Configure marked with highlight.js integration
// marked v4 uses a singleton — setOptions at module scope is safe for
// extension-scoped code since each extension has its own webpack context.
marked.setOptions({
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

/**
 * Strip dangerous HTML tags from rendered markdown output.
 * Removes script, iframe, object, embed, form, and event handler attributes.
 * @param {string} html - Raw HTML from marked parser
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
}

function MarkdownViewer({ content = '', error = false }) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);

  const htmlResult = useMemo(() => {
    if (error) return null;
    if (!content) return '';
    try {
      const raw = marked.parse(content);
      return sanitizeHtml(raw);
    } catch (_e) {
      return `<p>${t('viewer.parseError', 'Error parsing document.')}</p>`;
    }
  }, [content, error, t]);

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
        className={s.article}
        dangerouslySetInnerHTML={{ __html: htmlResult }}
      />
    </div>
  );
}

MarkdownViewer.propTypes = {
  content: PropTypes.string,
  error: PropTypes.bool,
};

export default MarkdownViewer;
