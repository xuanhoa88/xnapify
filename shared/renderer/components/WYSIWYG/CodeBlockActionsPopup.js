/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useMemo, useRef, useEffect } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu';

import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';

import s from './CodeBlockActionsPopup.css';

/**
 * CodeBlockActionsPopup — A toolbar button that toggles a code block
 * and, when active, allows the user to pick the syntax-highlighting
 * language from a searchable, scrollable dropdown.
 *
 * The `languages` list is passed from the parent so we avoid importing
 * the ESM-only `lowlight` package at the top level — which would break
 * the server-side CommonJS bundle.
 *
 * @param {Object}   props
 * @param {import('@tiptap/react').Editor} props.editor
 * @param {string[]} props.languages  Sorted list of lowlight language keys
 * @param {boolean}  [props.disabled]
 */
export default function CodeBlockActionsPopup({
  editor,
  languages = [],
  disabled,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  const isActive = editor.isActive('codeBlock');
  const activeLanguage = editor.getAttributes('codeBlock').language || 'auto';

  const filteredLanguages = useMemo(() => {
    if (!search) return languages || [];
    const q = search.toLowerCase();
    return (languages || []).filter(lang => lang.toLowerCase().includes(q));
  }, [languages, search]);

  // Reset search when menu closes (isActive changes or component unmounts)
  useEffect(() => {
    return () => setSearch('');
  }, [isActive]);

  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={Icons.code}
        title={t('shared:form.wysiwyg.codeBlock', 'Code Block')}
        isActive={isActive}
        disabled={disabled}
      />

      <ContextMenu.Menu>
        {/* Toggle Code Block */}
        <ContextMenu.Item
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {isActive
            ? t('shared:form.wysiwyg.removeCodeBlock', 'Remove Code Block')
            : t('shared:form.wysiwyg.insertCodeBlock', 'Insert Code Block')}
        </ContextMenu.Item>

        {isActive && (
          <>
            <ContextMenu.Divider />

            {/* Search filter */}
            <div className={s.searchWrapper}>
              <input
                ref={inputRef}
                type='text'
                className={s.searchInput}
                placeholder={t(
                  'shared:form.wysiwyg.searchLanguage',
                  'Search language…',
                )}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>

            {/* Scrollable language list */}
            <div className={s.languageList}>
              <ContextMenu.Item
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes('codeBlock', { language: null })
                    .run()
                }
              >
                Auto ({t('shared:form.wysiwyg.autoLanguage', 'Auto-detect')})
                {activeLanguage === 'auto' && ' ✓'}
              </ContextMenu.Item>

              {filteredLanguages.map(lang => (
                <ContextMenu.Item
                  key={lang}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes('codeBlock', { language: lang })
                      .run()
                  }
                >
                  {lang}
                  {activeLanguage === lang && ' ✓'}
                </ContextMenu.Item>
              ))}

              {filteredLanguages.length === 0 && (
                <div className={s.noResults}>
                  {t('shared:form.wysiwyg.noLanguageMatch', 'No match')}
                </div>
              )}
            </div>
          </>
        )}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

CodeBlockActionsPopup.propTypes = {
  editor: PropTypes.object.isRequired,
  languages: PropTypes.arrayOf(PropTypes.string),
  disabled: PropTypes.bool,
};
