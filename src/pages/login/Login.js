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
import { useHistory, useQuery } from '../../contexts/history';
import { useWebSocket } from '../../contexts/ws';
import s from './Login.css';

// Demo users for quick access
const DEMO_USERS = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'Administrator',
    avatar: '👑',
  },
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'password123',
    role: 'Editor',
    avatar: '👤',
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: 'password123',
    role: 'Viewer',
    avatar: '👩',
  },
  {
    name: 'Locked User',
    email: 'locked.user@example.com',
    password: 'demo123',
    role: 'Viewer',
    avatar: '🔒',
  },
];

function Login({ title }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const ws = useWebSocket();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get returnTo from query params
  const returnTo = useQuery('returnTo') || '/';

  // Handle quick login user selection
  const handleQuickLogin = useCallback(user => {
    setEmail(user.email);
    setPassword(user.password);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const result = await dispatch(login({ email, password, rememberMe }));

      setLoading(false);

      if (!result.success) {
        setError(result.error);
      } else {
        if (ws && result.accessToken) {
          ws.login(result.accessToken);
        }
        history.replace(returnTo);
      }
    },
    [email, password, rememberMe, dispatch, history, returnTo, ws],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        {error && <div className={s.error}>{error}</div>}

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
          <div className={s.formGroupCheckbox}>
            <label htmlFor='rememberMe'>
              <input
                id='rememberMe'
                type='checkbox'
                name='rememberMe'
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              {t('login.rememberMe', 'Remember me')}
            </label>
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

        {/* Quick Access User List */}
        <div className={s.quickAccess}>
          <h3 className={s.quickAccessTitle}>
            {t('login.quickAccess', 'Quick Access')}
          </h3>
          <div className={s.userList}>
            {DEMO_USERS.map(user => (
              <button
                key={user.email}
                type='button'
                className={s.userCard}
                onClick={() => handleQuickLogin(user)}
              >
                <span className={s.userAvatar}>{user.avatar}</span>
                <div className={s.userInfo}>
                  <span className={s.userName}>{user.name}</span>
                  <span className={s.userRole}>{user.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Login.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Login;
