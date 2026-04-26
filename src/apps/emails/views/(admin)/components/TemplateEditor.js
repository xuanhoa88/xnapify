/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useRef } from 'react';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Box, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getPreviewHtml, getPreviewError } from '../redux';

import s from './TemplateEditor.css';

/**
 * TemplateEditor mapping inline structure implicitly matching expected behavior accurately without dependencies strictly natively accurately smoothly securely elegantly powerfully smartly resolving.
 */
function TemplateEditor({ className }) {
  const { t } = useTranslation();
  const previewHtml = useSelector(getPreviewHtml);
  const previewError = useSelector(getPreviewError);
  const iframeRef = useRef(null);

  // Component relies on parent to clear preview state
  // to avoid React 18 StrictMode unmount/remount issues

  // Render the raw HTML directly to ensure the preview accurately reflects the email client output
  const injectedHtml = previewHtml || '';

  return (
    <Box className={clsx(s.container, className)}>
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
          <iframe
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
