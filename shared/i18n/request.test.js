/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18next from 'i18next';

import { createRequestI18n } from './request.js';

function createBase() {
  const base = i18next.createInstance();
  base.init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    defaultNS: 'translation',
    ns: ['translation'],
    initImmediate: false,
    resources: {
      'en-US': { translation: { greeting: 'Hello' } },
      'vi-VN': { translation: { greeting: 'Xin chào' } },
    },
  });
  return base;
}

describe('createRequestI18n', () => {
  test('clones with the requested language without touching the base', () => {
    const base = createBase();
    const vi = createRequestI18n('vi-VN', base);

    expect(vi.language).toBe('vi-VN');
    expect(vi.t('greeting')).toBe('Xin chào');
    expect(base.language).toBe('en-US');
    expect(base.t('greeting')).toBe('Hello');
  });

  test('concurrent clones keep independent languages', async () => {
    const base = createBase();
    const en = createRequestI18n('en-US', base);
    const vi = createRequestI18n('vi-VN', base);

    // Simulate a per-request setLocale() racing across two in-flight renders
    await Promise.all([en.changeLanguage('en-US'), vi.changeLanguage('vi-VN')]);

    expect(en.t('greeting')).toBe('Hello');
    expect(vi.t('greeting')).toBe('Xin chào');
    expect(base.language).toBe('en-US');
  });

  test('clones see namespaces registered on the shared store later', () => {
    const base = createBase();
    const clone = createRequestI18n('vi-VN', base);

    base.addResourceBundle(
      'vi-VN',
      'users',
      { title: 'Người dùng' },
      true,
      true,
    );

    expect(clone.t('users:title')).toBe('Người dùng');
  });

  test('falls back to the default locale for an empty locale', () => {
    const base = createBase();
    const clone = createRequestI18n('', base);
    expect(clone.language).toBe('en-US');
  });

  test('rejects a base that cannot be cloned', () => {
    expect(() => createRequestI18n('en-US', {})).toThrow(
      'does not support cloning',
    );
  });
});
