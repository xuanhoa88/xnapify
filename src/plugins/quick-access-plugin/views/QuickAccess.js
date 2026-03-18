/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import Button from '@shared/renderer/components/Button';
import { useFormContext } from '@shared/renderer/components/Form';

import s from './QuickAccess.scss';

const DEMO_USERS = Object.freeze([
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'Administrator',
  },
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'password123',
    role: 'Editor',
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: 'password123',
    role: 'Viewer',
  },
]);

export default function QuickAccess() {
  const { t } = useTranslation();
  const { setValue, handleSubmit } = useFormContext();

  const handleQuickLogin = useCallback(
    user => {
      setValue('email', user.email, { shouldValidate: false });
      setValue('password', user.password, { shouldValidate: false });
      setValue('rememberMe', true, { shouldValidate: false });

      setTimeout(() => {
        handleSubmit(() => {
          const formElement = document.querySelector('form');
          if (formElement) {
            formElement.dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true }),
            );
          }
        })();
      }, 100);
    },
    [setValue, handleSubmit],
  );

  const handleKeyDown = useCallback(
    event => {
      const { key } = event;
      if (key >= '1' && key <= '3') {
        const userIndex = parseInt(key, 10) - 1;
        if (DEMO_USERS[userIndex]) {
          event.preventDefault();
          handleQuickLogin(DEMO_USERS[userIndex]);
        }
      }
    },
    [handleQuickLogin],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={s.root}>
      <h3 className={s.title}>
        {t('login.quickAccess', 'Quick Access')}
        <span className={s.hint}>
          {t('login.quickAccessHint', 'Press 1-3 or click to login')}
        </span>
      </h3>
      <div className={s.userList}>
        {DEMO_USERS.map((user, index) => (
          <Button
            key={user.email}
            variant='ghost'
            className={s.userCard}
            onClick={() => handleQuickLogin(user)}
          >
            <span className={s.shortcut}>{index + 1}</span>
            <div className={s.userInfo}>
              <span className={s.userName}>{user.name}</span>
              <span className={s.userRole}>{user.role}</span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
