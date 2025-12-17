/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { resetPassword } from '../../redux';
import s from './ResetPassword.css';

function ResetPassword() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setSuccess(false);
      setLoading(true);

      const result = await dispatch(resetPassword({ email }));

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        setEmail(''); // Clear email on success
      } else {
        setError(result.error);
      }
    },
    [email, dispatch],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{t('resetPassword.title')}</h1>

        {error && <div className={s.error}>{error}</div>}

        {success && (
          <div className={s.success}>
            <Trans
              t={t}
              i18nKey='resetPassword.success'
              // eslint-disable-next-line react/jsx-key
              components={[<strong />]}
            />
          </div>
        )}

        <form method='post' onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='email'>
              {t('resetPassword.email')}
              <input
                className={s.input}
                id='email'
                type='email'
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <button className={s.button} type='submit' disabled={loading}>
              {loading ? t('resetPassword.loading') : t('resetPassword.submit')}
            </button>
          </div>
        </form>
        <div className={s.formGroup}>
          <a href='/login' className={s.buttonLink}>
            {t('resetPassword.backToLogin')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
