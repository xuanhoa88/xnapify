/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import s from './Feedback.css';

/**
 * Feedback Section Component
 * Displays links for asking questions and reporting issues
 */
function Feedback() {
  const { t } = useTranslation();

  return (
    <section className={s.root}>
      <div className={s.container}>
        <a
          className={s.link}
          href='https://gitter.im/xuanhoa88/rapid-rsk'
          target='_blank'
          rel='noopener noreferrer'
        >
          <svg
            className={s.icon}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='12' cy='12' r='10' />
            <path d='M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' />
            <line x1='12' y1='17' x2='12.01' y2='17' />
          </svg>
          {t('home.feedback.askQuestion', 'Ask a question')}
        </a>
        <span className={s.spacer}>|</span>
        <a
          className={s.link}
          href='https://github.com/xuanhoa88/rapid-rsk/issues/new'
          target='_blank'
          rel='noopener noreferrer'
        >
          <svg
            className={s.icon}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3' />
          </svg>
          {t('home.feedback.reportIssue', 'Report an issue')}
        </a>
      </div>
    </section>
  );
}

export default Feedback;
