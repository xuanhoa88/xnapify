/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { emailVerification } from '../../redux';
import s from './EmailVerification.css';

function EmailVerification({ token: initialToken }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [token, setToken] = useState(initialToken || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = useCallback(
    async tokenToVerify => {
      setError('');
      setSuccess(false);
      setLoading(true);

      const result = await dispatch(
        emailVerification({ token: tokenToVerify }),
      );

      setLoading(false);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    },
    [dispatch],
  );

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      handleVerify(token);
    },
    [token, handleVerify],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{t('emailVerification.title')}</h1>

        {loading && (
          <div className={s.info}>
            <p>{t('emailVerification.verifying')}</p>
          </div>
        )}

        {error && !loading && (
          <div className={s.error}>
            <strong>{t('emailVerification.error')}</strong> {error}
          </div>
        )}

        {success && !loading && (
          <div className={s.success}>
            <Trans
              t={t}
              i18nKey='emailVerification.success'
              // eslint-disable-next-line react/jsx-key
              components={[<strong />]}
            />
            <div className={s.formGroup}>
              <a href='/login' className={s.button}>
                {t('emailVerification.goToLogin')}
              </a>
            </div>
          </div>
        )}

        {!success && !loading && (
          <form method='post' onSubmit={handleSubmit}>
            <p className={s.description}>
              {t('emailVerification.description')}
            </p>
            {!initialToken && (
              <div className={s.formGroup}>
                <label className={s.label} htmlFor='token'>
                  {t('emailVerification.token')}
                  <input
                    className={s.input}
                    id='token'
                    type='text'
                    name='token'
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    required
                    placeholder={t('emailVerification.tokenPlaceholder')}
                  />
                </label>
              </div>
            )}
            <div className={s.formGroup}>
              <button className={s.button} type='submit' disabled={loading}>
                {loading
                  ? t('emailVerification.loading')
                  : t('emailVerification.submit')}
              </button>
            </div>
          </form>
        )}
        <div className={s.formGroup}>
          <a href='/login' className={s.buttonLink}>
            {t('emailVerification.backToLogin')}
          </a>
        </div>
      </div>
    </div>
  );
}

EmailVerification.propTypes = {
  token: PropTypes.string.isRequired,
};

export default EmailVerification;
