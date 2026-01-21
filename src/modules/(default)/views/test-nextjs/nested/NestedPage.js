/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import TestLayout from '../components/TestLayout';
import s from './NestedPage.css';

export default function NestedTestPage() {
  return (
    <TestLayout>
      <div>
        <h1 className={s.title}>✅ Nested Page Works!</h1>

        <div className={s.card}>
          <h2>Layout Nesting Test</h2>
          <p>
            This page is explicitly wrapped by the <code>TestLayout</code>{' '}
            component. You should see a blue dashed border around this content.
          </p>

          <h3 className={s.heading}>File Location:</h3>
          <code className={s.codeBlock}>
            src/modules/(default)/views/test-nextjs/nested/page.js
          </code>

          <h3 className={s.heading}>Route Path:</h3>
          <code className={s.codeBlock}>/test-nextjs/nested</code>

          <h3 className={s.heading}>Layout Hierarchy:</h3>
          <ol>
            <li>Root Layout (if exists)</li>
            <li>
              TestLayout (Explicit Wrapper) ← <strong>Wraps this page</strong>
            </li>
            <li>This page content</li>
          </ol>
        </div>

        <div className={s.backLink}>
          <a href='/test-nextjs' className={s.link}>
            ← Back to Test Home
          </a>
        </div>
      </div>
    </TestLayout>
  );
}
