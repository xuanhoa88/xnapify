/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';

import Icon from '@shared/renderer/components/Icon';

import s from './Loader.css';

function Loader() {
  const { t } = useTranslation();

  return (
    <div className={s.root}>
      <div className={s.spinner}>
        <Icon name='loader' size={24} />
      </div>
      <span>{t('loading', 'Loading...')}</span>
    </div>
  );
}

export default Loader;
