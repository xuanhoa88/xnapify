/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, lazy, Suspense } from 'react';

import PropTypes from 'prop-types';

import s from './Placeholder.css';

/**
 * The editor pulls in TipTap, ProseMirror, lowlight and KaTeX — close to
 * 300 KB compressed. Loading it through a lazy boundary keeps that out of
 * every page that merely reaches a form component and defers it to the first
 * render of an editor.
 *
 * The Suspense fallback reserves the editor's footprint so the layout does not
 * jump when the chunk arrives. It reserves it itself, through the spacer in
 * Placeholder.css, rather than relying on the caller's `className`: only some
 * callers pass one that happens to carry a height, and the ones that do not
 * (profile's `PersonalInfoCard`) would otherwise get a zero-height fallback
 * and a full-editor jump.
 */
const Editor = lazy(() => import('./WYSIWYG.js'));

export const WYSIWYG = forwardRef(function LazyWYSIWYG(props, ref) {
  return (
    <Suspense
      fallback={
        <div
          className={props.className}
          data-wysiwyg-loading=''
          aria-busy='true'
        >
          <div className={s.reservedSpace} />
        </div>
      }
    >
      <Editor ref={ref} {...props} />
    </Suspense>
  );
});

WYSIWYG.propTypes = {
  className: PropTypes.string,
};

export default WYSIWYG;
