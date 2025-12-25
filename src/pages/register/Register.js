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
import { Link, useHistory, useQuery } from '../../components/History';
import Button from '../../components/Button';
import s from './Register.css';

/**
 * Register Page Component
 * Standalone full-page registration without header/footer
 */
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
        setError(
          t('register.errors.displayNameRequired', 'Display name is required'),
        );
        return;
      }

      if (password.length < 6) {
        setError(
          t(
            'register.errors.passwordLength',
            'Password must be at least 6 characters long',
          ),
        );
        return;
      }

      if (password !== confirmPassword) {
        setError(
          t('register.errors.passwordMismatch', 'Passwords do not match'),
        );
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
      t,
    ],
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
          <h1 className={s.heroTitle}>
            {t('register.welcome', 'Create Account')}
          </h1>
          <p className={s.heroSubtitle}>
            {t('register.heroSubtitle', 'Join us and start your journey')}
          </p>
        </div>
      </div>

      {/* Form Section (Right) */}
      <div className={s.formSection}>
        <div className={s.formContainer}>
          <h2 className={s.formTitle}>
            {t('navigation.register', 'Register')}
          </h2>

          {error && <div className={s.error}>{error}</div>}

          <form method='post' onSubmit={handleSubmit}>
            <div className={s.formGroup}>
              <label className={s.label} htmlFor='displayName'>
                {t('register.displayName')}
              </label>
              <input
                className={s.input}
                id='displayName'
                type='text'
                name='displayName'
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('register.displayNamePlaceholder', 'Your name')}
                required
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.label} htmlFor='email'>
                {t('register.email')}
              </label>
              <input
                className={s.input}
                id='email'
                type='email'
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t(
                  'register.emailPlaceholder',
                  'your.email@example.com',
                )}
                required
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.label} htmlFor='password'>
                {t('register.password')}
              </label>
              <input
                className={s.input}
                id='password'
                type='password'
                name='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
                required
                minLength='6'
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.label} htmlFor='confirmPassword'>
                {t('register.confirmPassword')}
              </label>
              <input
                className={s.input}
                id='confirmPassword'
                type='password'
                name='confirmPassword'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder='••••••••'
                required
                minLength='6'
              />
            </div>

            <Button
              variant='primary'
              type='submit'
              fullWidth
              className={s.submitButton}
              loading={loading}
            >
              {loading ? t('register.loading') : t('register.submit')}
            </Button>
          </form>

          <div className={s.loginLink}>
            <Trans
              t={t}
              i18nKey='register.alreadyHaveAccount'
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              components={[<Link to='/login' className={s.link} />]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
