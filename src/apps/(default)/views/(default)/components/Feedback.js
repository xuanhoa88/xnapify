/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';

import Icon from '@shared/renderer/components/Icon';

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
          href='https://gitter.im/xuanhoa88/xnapify'
          target='_blank'
          rel='noopener noreferrer'
        >
          <Icon name='help-circle' size={20} className={s.icon} />
          {t('home.feedback.askQuestion', 'Ask a question')}
        </a>
        <span className={s.spacer}>|</span>
        <a
          className={s.link}
          href='https://github.com/xuanhoa88/xnapify/issues/new'
          target='_blank'
          rel='noopener noreferrer'
        >
          <Icon name='thumbs-up' size={20} className={s.icon} />
          {t('home.feedback.reportIssue', 'Report an issue')}
        </a>
      </div>
    </section>
  );
}

export default Feedback;
