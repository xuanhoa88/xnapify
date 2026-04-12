/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

/* eslint-disable css-modules/no-unused-class */
import s from './MarkdownViewer.css';

import 'highlight.js/styles/github.css';

function MarkdownViewer({
  context: { initialProps: { htmlResult = '', error = false } = {} } = {},
}) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);
  const articleRef = useRef(null);

  useEffect(() => {
    // 4. Safely invoke Mermaid rendering on parsed elements post-DOM-hydration
    if (htmlResult && articleRef.current) {
      import('mermaid')
        .then(({ default: mermaid }) => {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'strict',
          });

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
        })
        .catch(err => {
          console.error('Failed to load mermaid for SSR safety', err);
        });
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
    initialProps: PropTypes.shape({
      htmlResult: PropTypes.string,
      error: PropTypes.bool,
    }),
  }).isRequired,
};

export default MarkdownViewer;
