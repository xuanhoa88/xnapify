/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './SidebarLayout.css';

export default function DocsLayout({
  children,
  context: { history, initialProps },
}) {
  const { t } = useTranslation(`extension:${__EXTENSION_ID__}`);

  const tree = useMemo(
    () =>
      initialProps && Array.isArray(initialProps.tree) ? initialProps.tree : [],
    [initialProps],
  );

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
                <a
                  href={`/docs/${node.path}`}
                  onClick={e => {
                    e.preventDefault();
                    history.push(`/docs/${node.path}`);
                  }}
                  className={clsx(
                    s.link,
                    history.location.pathname === `/docs/${node.path}` &&
                      s.active,
                  )}
                >
                  {node.name}
                </a>
              </li>
            );
          })}
        </ul>
      );
    },
    [history], // stable — renderTree only depends on CSS module `s` which is static
  );

  return (
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <div className={s.sidebarHeader}>
          <h2>
            <a
              href='/'
              className={s.link}
              onClick={e => {
                e.preventDefault();
                history.push('/');
              }}
            >
              {t('title', 'xnapify')}
            </a>
          </h2>
        </div>
        <div className={s.sidebarContent}>{renderTree(tree)}</div>
      </aside>
      <main className={s.mainContent}>{children}</main>
    </div>
  );
}

DocsLayout.propTypes = {
  children: PropTypes.node.isRequired,
  context: PropTypes.shape({
    history: PropTypes.object.isRequired,
    initialProps: PropTypes.shape({
      tree: PropTypes.array,
    }),
  }).isRequired,
};
