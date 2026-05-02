/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';

import { CodeIcon, CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { useFormContext } from '@shared/renderer/components/Form';

import { extractVariables } from '../../../utils/template';

import s from './TemplateVariables.css';

/**
 * TemplateVariables utilizing Radix explicitly preventing pure DOM overrides enforcing exact design parameters effectively reliably cleanly beautifully efficiently safely robustly.
 */
export default function TemplateVariables() {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  // Watch the form values
  const subject = watch('subject');
  const htmlBody = watch('html_body');

  // Track copied state for individual chips
  const [copiedVar, setCopiedVar] = useState(null);

  // Compute the unique variables on the fly
  const variables = useMemo(() => {
    const combinedText = `${subject || ''} ${htmlBody || ''}`;
    return extractVariables(combinedText);
  }, [subject, htmlBody]);

  // Handle clicking a variable chip to copy it to clipboard
  const handleCopy = useCallback(variable => {
    const formattedVar = `{{ ${variable} }}`;
    navigator.clipboard
      .writeText(formattedVar)
      .then(() => {
        setCopiedVar(variable);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  }, []);

  // Clear the "Copied!" state after a brief delay
  useEffect(() => {
    if (copiedVar) {
      const timer = setTimeout(() => {
        setCopiedVar(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copiedVar]);

  if (!subject && !htmlBody) {
    return null; // Don't render until form initializes
  }

  return (
    <Flex align='center' wrap='wrap' gap='2' className={s.container}>
      <Flex align='center' gap='2' className={s.titleFlex}>
        <CodeIcon width={16} height={16} />
        {t('admin:emails.form.detectedVariables', 'Detected Variables:')}
      </Flex>
      {variables.length === 0 ? (
        <Text size='2' color='gray' className={s.emptyText}>
          {t(
            'admin:emails.form.noVariables',
            'None found. Use {{ var }} to insert dynamic data.',
          )}
        </Text>
      ) : (
        variables.map(v => (
          <Flex
            as='button'
            key={v}
            type='button'
            align='center'
            gap='1'
            onClick={() => handleCopy(v)}
            title={t('admin:emails.form.clickToCopy', 'Click to copy')}
            className={clsx(
              s.variableBtn,
              copiedVar === v ? s.variableBtnCopied : s.variableBtnNormal,
            )}
          >
            {copiedVar === v ? (
              <CheckIcon width={14} height={14} />
            ) : (
              <CopyIcon width={14} height={14} />
            )}
            {v}
          </Flex>
        ))
      )}
    </Flex>
  );
}
