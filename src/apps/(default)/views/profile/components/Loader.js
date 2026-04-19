/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { LoaderIcon } from '@radix-ui/react-icons';
import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import s from './Loader.css';

/**
 * Profile Component Loader utilizing standard programmatic UI Box assignments
 */
function Loader() {
  const { t } = useTranslation();

  return (
    <Flex direction='column' align='center' justify='center' gap='3' p='8'>
      <Flex className={s.loaderIconWrapper}>
        <LoaderIcon width={32} height={32} className={s.loaderSpin} />
      </Flex>
      <Text size='3' color='gray'>
        {t('loading', 'Loading...')}
      </Text>
    </Flex>
  );
}

export default Loader;
