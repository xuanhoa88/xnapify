/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { QuestionMarkCircledIcon, FaceIcon } from '@radix-ui/react-icons';
import { Flex, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import s from './Feedback.css';

/**
 * Feedback Section Component explicitly discarding absolute structures mapping explicitly.
 */
function Feedback() {
  const { t } = useTranslation();

  return (
    <Box as='section' className={s.feedbackSection}>
      <Flex
        align='center'
        justify='center'
        gap='4'
        wrap='wrap'
        className={s.feedbackContainer}
      >
        <Flex asChild align='center' gap='2' className={s.feedbackLink}>
          <a
            href='https://gitter.im/xuanhoa88/xnapify'
            target='_blank'
            rel='noopener noreferrer'
          >
            <QuestionMarkCircledIcon width={20} height={20} />
            {t('home.feedback.askQuestion', 'Ask a question')}
          </a>
        </Flex>

        <Box className={s.feedbackDivider}>|</Box>

        <Flex asChild align='center' gap='2' className={s.feedbackLink}>
          <a
            href='https://github.com/xuanhoa88/xnapify/issues/new'
            target='_blank'
            rel='noopener noreferrer'
          >
            <FaceIcon width={20} height={20} />
            {t('home.feedback.reportIssue', 'Report an issue')}
          </a>
        </Flex>
      </Flex>
    </Box>
  );
}

export default Feedback;
