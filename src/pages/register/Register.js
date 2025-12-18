/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { register } from '../../redux';
import { useHistory, useQuery } from '../../components/History';
import s from './Register.css';

function Register() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get returnTo from query params
  const returnTo = useQuery('returnTo') || '/login';

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');

      // Validation
      if (!displayName.trim()) {
        setError('Display name is required');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);

      const result = await dispatch(
        register({
          displayName: displayName.trim(),
          email,
          password,
        }),
      );

      setLoading(false);

      if (!result.success) {
        setError(result.error);
      } else {
        history.replace(returnTo);
      }
    },
    [
      displayName,
      email,
      password,
      confirmPassword,
      dispatch,
      history,
      returnTo,
    ],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{t('navigation.register')}</h1>

        {error && <div className={s.error}> {error}</div>}

        <form method='post' onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='displayName'>
              {t('register.displayName')}
              <input
                className={s.input}
                id='displayName'
                type='text'
                name='displayName'
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='email'>
              {t('register.email')}
              <input
                className={s.input}
                id='email'
                type='email'
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='password'>
              {t('register.password')}
              <input
                className={s.input}
                id='password'
                type='password'
                name='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength='6'
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='confirmPassword'>
              {t('register.confirmPassword')}
              <input
                className={s.input}
                id='confirmPassword'
                type='password'
                name='confirmPassword'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength='6'
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <button className={s.button} type='submit' disabled={loading}>
              {loading ? t('register.loading') : t('register.submit')}
            </button>
          </div>
        </form>
        <div className={s.linkWrapper}>
          <Trans
            t={t}
            i18nKey='register.alreadyHaveAccount'
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            components={[<a href='/login' className={s.buttonLink} />]}
          />
        </div>
      </div>
    </div>
  );
}

export default Register;
