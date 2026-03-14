/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { useFormContext } from '@shared/renderer/components/Form';
import Icon from '@shared/renderer/components/Icon';

import { extractVariables } from '../../../utils/template';

import s from './TemplateVariables.css';

/**

 * TemplateVariables component
 * Uses react-hook-form context to watch `subject` and `html_body` inputs,
 * extracts LiquidJS variables (`{{ variable }}`), and displays them as chips.
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
    <div className={s.root}>
      <span className={s.label}>
        <Icon name='code' size={16} />
        {t('admin:emails.form.detectedVariables', 'Detected Variables:')}
      </span>
      {variables.length === 0 ? (
        <span className={s.emptyText}>
          {t(
            'admin:emails.form.noVariables',
            'None found. Use {{ var }} to insert dynamic data.',
          )}
        </span>
      ) : (
        variables.map(v => (
          <button
            key={v}
            type='button'
            className={clsx(s.chip, { [s.copiedTag]: copiedVar === v })}
            onClick={() => handleCopy(v)}
            title={t('admin:emails.form.clickToCopy', 'Click to copy')}
          >
            {copiedVar === v ? (
              <Icon name='check' size={14} />
            ) : (
              <Icon name='copy' size={14} />
            )}
            {v}
          </button>
        ))
      )}
    </div>
  );
}
