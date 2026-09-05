/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, lazy, Suspense } from 'react';

import PropTypes from 'prop-types';

/**
 * The editor pulls in TipTap, ProseMirror, lowlight and KaTeX — close to
 * 300 KB compressed. Loading it through a lazy boundary keeps that out of
 * every page that merely reaches a form component and defers it to the first
 * render of an editor. The Suspense fallback reserves the editor's footprint
 * so the layout does not jump when the chunk arrives.
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
        />
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
