/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import s from './SidebarLayout.css';

export default function DocsLayout({ children }) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/docs/tree', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.tree) {
          setTree(data.tree);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[DocsLayout] fetch failed', err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const renderTree = useCallback(
    (nodes, depth) => {
      if (!nodes || nodes.length === 0) return null;
      const level = depth || 0;
      return (
        <ul className={level === 0 ? s.rootList : s.nestedList}>
          {nodes.map(node => {
            if (node.type === 'directory') {
              return (
                <li key={node.path} className={s.dirNode}>
                  <div className={s.dirLabel}>{node.name}</div>
                  {renderTree(node.children, level + 1)}
                </li>
              );
            }
            return (
              <li key={node.path} className={s.fileNode}>
                <Link
                  to={`/docs/${node.path}`}
                  className={({ isActive }) =>
                    clsx(s.link, { [s.active]: isActive })
                  }
                >
                  {node.name}
                </Link>
              </li>
            );
          })}
        </ul>
      );
    },
    [], // stable — renderTree only depends on CSS module `s` which is static
  );

  return (
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <div className={s.sidebarHeader}>
          <h2>{t('sidebar.title', 'Documentation')}</h2>
        </div>
        <div className={s.sidebarContent}>
          {loading ? (
            <div className={s.loading}>
              {t('sidebar.loading', 'Loading...')}
            </div>
          ) : (
            renderTree(tree)
          )}
        </div>
      </aside>
      <main className={s.mainContent}>{children}</main>
    </div>
  );
}

DocsLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
