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
import { login } from '../../redux';
import { useHistory, useLocation } from '../../contexts/history';
import s from './Login.css';

function Login({ title }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get returnTo from query params
  const returnTo = new URLSearchParams(location.search).get('returnTo') || '/';

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const result = await dispatch(login({ email, password }));

      setLoading(false);

      if (!result.success) {
        setError(result.error);
      } else {
        history.replace(returnTo);
      }
    },
    [email, password, dispatch, history, returnTo],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        {error && (
          <div className={s.error}>
            <strong>{t('login.error')}</strong> {error}
          </div>
        )}

        <form method='post' onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='email'>
              {t('login.email')}
              <input
                className={s.input}
                id='email'
                type='email'
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </label>
          </div>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='password'>
              {t('login.password')}
              <input
                className={s.input}
                id='password'
                type='password'
                name='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
            <a href='/reset-password' className={s.forgotPasswordLink}>
              {t('login.forgotPassword')}
            </a>
          </div>
          <div className={s.formGroup}>
            <button className={s.button} type='submit' disabled={loading}>
              {loading ? t('login.loading') : t('login.submit')}
            </button>
          </div>
        </form>
        <div className={s.linkWrapper}>
          <Trans
            t={t}
            i18nKey='login.dontHaveAccount'
            // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
            components={[<a href='/register' className={s.buttonLink} />]}
          />
        </div>
      </div>
    </div>
  );
}

Login.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Login;
