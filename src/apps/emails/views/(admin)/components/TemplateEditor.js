/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useEffect, useRef } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Icon from '@shared/renderer/components/Icon';

import { getPreviewHtml, getPreviewError, clearPreview } from '../redux';

import { TIPTAP_CORE_STYLES } from './styles';

import s from './TemplateEditor.css';

/**
 * TemplateEditor — Preview-only component for email template live preview
 *
 * Watches `subject` and `html_body` from react-hook-form context
 * and renders a live preview in a sandboxed iframe.
 */
function TemplateEditor({ className }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const previewHtml = useSelector(getPreviewHtml);
  const previewError = useSelector(getPreviewError);
  const iframeRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearPreview());
    };
  }, [dispatch]);

  // Inject essential Tiptap styles so the iframe preview closely matches the editor
  const injectedHtml = useMemo(() => {
    if (!previewHtml) return '';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
${TIPTAP_CORE_STYLES}
          </style>
        </head>
        <body class='ProseMirror'>
          ${previewHtml}
        </body>
      </html>
    `;
  }, [previewHtml]);

  return (
    <div className={clsx(s.root, className)}>
      {/* Preview Pane */}
      <div className={s.previewPane}>
        {previewError ? (
          <div className={s.previewError}>
            <Icon name='alert-triangle' size={16} />
            <span>
              {typeof previewError === 'string'
                ? previewError
                : previewError.details ||
                  t('admin:emails.modal.previewError', 'Rendering error')}
            </span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            className={s.previewIframe}
            title={t('admin:emails.modal.previewTitle', 'Preview Template')}
            sandbox='allow-popups'
            srcDoc={injectedHtml || ''}
          />
        )}
      </div>
    </div>
  );
}

TemplateEditor.propTypes = {
  className: PropTypes.string,
};

export default TemplateEditor;
