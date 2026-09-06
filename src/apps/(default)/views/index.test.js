/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import uiReducer from '@shared/renderer/redux/features/ui/slice.js';

import viewModule from './index.js';

/** The label the drawer renders for the section, in two languages. */
const i18n = translated => ({ t: (_key, fallback) => translated || fallback });

/**
 * Runs the module's `menus` hook against the real ui reducer and returns the
 * resulting `ui.menus` map — the slice the admin drawer reads.
 */
function collectMenus(...languages) {
  let state = uiReducer(undefined, { type: '@@INIT' });
  const runs = languages.length > 0 ? languages : [null];
  for (const translated of runs) {
    viewModule.menus({
      store: { dispatch: action => (state = uiReducer(state, action)) },
      i18n: i18n(translated),
    });
  }
  return state.menus;
}

describe('(default) view module menus', () => {
  it('registers the Dashboard link where the admin drawer looks for it', () => {
    // The drawer reads `state.ui.menus.admin`. Registering under the
    // *translated* section label instead put the entry in `menus.Main`, so
    // the Dashboard link never rendered.
    const menus = collectMenus();

    expect(Object.keys(menus)).toEqual(['admin']);
    expect(menus.admin.flatMap(s => s.items.map(i => i.path))).toContain(
      '/admin',
    );
  });

  it('keeps the translated string as the section label', () => {
    const menus = collectMenus('Chính');

    expect(menus.admin.find(s => s.id === 'main').label).toBe('Chính');
  });

  it('leaves no orphan section behind when the language changes', () => {
    // `menus` re-runs on every languageChanged (see watchLocaleForMenus in
    // src/bootstrap/views.js) and the reducer creates a section per distinct
    // namespace, so a translated `ns` accumulated one dead section per switch.
    const menus = collectMenus('Main', 'Chính', 'メイン');

    expect(Object.keys(menus)).toEqual(['admin']);
    expect(menus.admin).toHaveLength(1);
  });
});
