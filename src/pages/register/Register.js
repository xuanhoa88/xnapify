/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { register } from '../../redux';
import { replaceTo, getQueryParam } from '../../navigator';
import s from './Register.css';

function Register({ title }) {
  const dispatch = useDispatch();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        const returnTo = getQueryParam('returnTo');
        replaceTo(returnTo || '/');
      }
    },
    [displayName, email, password, confirmPassword, dispatch],
  );

  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>

        {error && (
          <div className={s.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <form method='post' onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label} htmlFor='displayName'>
              Display Name:
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
              Email address:
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
              Password:
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
              Confirm Password:
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
              {loading ? 'Please wait...' : 'Create Account'}
            </button>
          </div>
        </form>
        <div className={s.formGroup}>
          <a href='/login' className={s.buttonLink}>
            Already have an account? Log in
          </a>
        </div>
      </div>
    </div>
  );
}

Register.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Register;
