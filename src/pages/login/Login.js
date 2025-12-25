/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { login } from '../../redux';
import { Link, useHistory, useQuery } from '../../components/History';
import { useWebSocket } from '../../components/WebSocket';
import Button from '../../components/Button';
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
];

/**
 * Login Page Component
 * Standalone full-page login without header/footer
 */
function Login() {
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
      {/* Hero Section (Left) */}
      <div className={s.hero}>
        <div className={s.heroContent}>
          <Link to='/' className={s.brand}>
            <img
              src='/rsk_38x38.png'
              srcSet='/rsk_72x72.png 2x'
              width='48'
              height='48'
              alt='RSK'
            />
            <span className={s.brandText}>React Starter Kit</span>
          </Link>
          <h1 className={s.heroTitle}>{t('login.welcome', 'Welcome Back')}</h1>
          <p className={s.heroSubtitle}>
            {t('login.heroSubtitle', 'Sign in to continue to your account')}
          </p>
        </div>
      </div>

      {/* Form Section (Right) */}
      <div className={s.formSection}>
        <div className={s.formContainer}>
          <h2 className={s.formTitle}>{t('navigation.login', 'Log In')}</h2>

          {error && <div className={s.error}>{error}</div>}

          <form method='post' onSubmit={handleSubmit}>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='email'>
                {t('login.email')}
              </label>
              <input
                className={s.input}
                id='email'
                type='email'
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t(
                  'login.emailPlaceholder',
                  'your.email@example.com',
                )}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <div className={s.formGroup}>
              <div className={s.labelRow}>
                <label className={s.label} htmlFor='password'>
                  {t('login.password')}
                </label>
                <Link to='/reset-password' className={s.forgotLink}>
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <input
                className={s.input}
                id='password'
                type='password'
                name='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
                required
              />
            </div>

            <div className={s.checkboxGroup}>
              <label className={s.checkboxLabel} htmlFor='rememberMe'>
                <input
                  id='rememberMe'
                  type='checkbox'
                  name='rememberMe'
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className={s.checkbox}
                />
                <span>{t('login.rememberMe', 'Remember me')}</span>
              </label>
            </div>

            <Button
              variant='primary'
              type='submit'
              fullWidth
              className={s.submitButton}
              loading={loading}
            >
              {loading ? t('login.loading') : t('login.submit')}
            </Button>
          </form>

          <div className={s.registerLink}>
            <Trans
              t={t}
              i18nKey='login.dontHaveAccount'
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              components={[<Link to='/register' className={s.link} />]}
            />
          </div>

          {/* Quick Access */}
          <div className={s.quickAccess}>
            <h3 className={s.quickAccessTitle}>
              {t('login.quickAccess', 'Quick Access')}
            </h3>
            <div className={s.userList}>
              {DEMO_USERS.map(user => (
                <Button
                  key={user.email}
                  variant='ghost'
                  className={s.userCard}
                  onClick={() => handleQuickLogin(user)}
                >
                  <span className={s.userAvatar}>{user.avatar}</span>
                  <div className={s.userInfo}>
                    <span className={s.userName}>{user.name}</span>
                    <span className={s.userRole}>{user.role}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
