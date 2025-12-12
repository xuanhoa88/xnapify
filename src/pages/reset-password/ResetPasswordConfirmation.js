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
import { resetPasswordConfirmation } from '../../redux';
import s from './ResetPassword.css';

function ResetPasswordConfirmation({ title, token }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setSuccess(false);

      // Validate passwords match
      if (password && password !== confirmPassword) {
        setError(t('resetPasswordConfirmation.passwordMismatch'));
        return;
      }

      // Validate password length
      if (password.length < 8) {
        setError(t('resetPasswordConfirmation.passwordTooShort'));
        return;
      }

      setLoading(true);

      const result = await dispatch(
        resetPasswordConfirmation({ token, password, confirmPassword }),
      );

      setLoading(false);

      if (result.success) {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error);
      }
    },
    [token, password, confirmPassword, dispatch, t],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>

        {error && (
          <div className={s.error}>
            <strong>{t('resetPasswordConfirmation.error')}</strong> {error}
          </div>
        )}

        {success ? (
          <div className={s.success}>
            <Trans
              t={t}
              i18nKey='resetPasswordConfirmation.success'
              // eslint-disable-next-line react/jsx-key
              components={[<strong />]}
            />
            <div className={s.formGroup}>
              <a href='/login' className={s.button}>
                {t('resetPasswordConfirmation.goToLogin')}
              </a>
            </div>
          </div>
        ) : (
          <form method='post' onSubmit={handleSubmit}>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='password'>
                {t('resetPasswordConfirmation.newPassword')}
                <input
                  className={s.input}
                  id='password'
                  type='password'
                  name='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                />
              </label>
            </div>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='confirmPassword'>
                {t('resetPasswordConfirmation.confirmPassword')}
                <input
                  className={s.input}
                  id='confirmPassword'
                  type='password'
                  name='confirmPassword'
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
            </div>
            <div className={s.formGroup}>
              <button className={s.button} type='submit' disabled={loading}>
                {loading
                  ? t('resetPasswordConfirmation.loading')
                  : t('resetPasswordConfirmation.submit')}
              </button>
            </div>
          </form>
        )}
        <div className={s.formGroup}>
          <a href='/login' className={s.buttonLink}>
            {t('resetPasswordConfirmation.backToLogin')}
          </a>
        </div>
      </div>
    </div>
  );
}

ResetPasswordConfirmation.propTypes = {
  title: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
};

export default ResetPasswordConfirmation;
