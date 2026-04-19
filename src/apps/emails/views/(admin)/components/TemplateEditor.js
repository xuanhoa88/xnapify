/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useEffect, useRef } from 'react';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Box, Flex, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { getPreviewHtml, getPreviewError, clearPreview } from '../redux';

import { TIPTAP_CORE_STYLES } from './styles';

import s from './TemplateEditor.css';

/**
 * TemplateEditor mapping inline structure implicitly matching expected behavior accurately without dependencies strictly natively accurately smoothly securely elegantly powerfully smartly resolving.
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
            body { margin: 0; padding: 1rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          </style>
        </head>
        <body class='ProseMirror'>
          ${previewHtml}
        </body>
      </html>
    `;
  }, [previewHtml]);

  return (
    <Box className={`${s.container} ${className || ''}`}>
      {/* Preview Pane */}
      <Box className={s.previewPane}>
        {previewError ? (
          <Flex align='center' justify='center' gap='2' className={s.errorFlex}>
            <ExclamationTriangleIcon width={24} height={24} />
            <Text size='3' weight='bold'>
              {typeof previewError === 'string'
                ? previewError
                : previewError.details ||
                  t('admin:emails.modal.previewError', 'Rendering error')}
            </Text>
          </Flex>
        ) : (
          <Box
            as='iframe'
            ref={iframeRef}
            title={t('admin:emails.modal.previewTitle', 'Preview Template')}
            sandbox='allow-popups'
            srcDoc={injectedHtml || ''}
            className={s.previewIframe}
          />
        )}
      </Box>
    </Box>
  );
}

TemplateEditor.propTypes = {
  className: PropTypes.string,
};

export default TemplateEditor;
