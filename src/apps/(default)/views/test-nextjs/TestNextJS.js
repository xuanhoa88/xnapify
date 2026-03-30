/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import s from './TestNextJS.css';

export default function TestNextJSPage() {
  return (
    <div className={s.container}>
      <h1 className={s.title}>✅ Next.js-Style Routing Works!</h1>

      <div className={s.card}>
        <h2>File-Based Routing Test</h2>
        <p>This page was created using the new Next.js-style routing system.</p>

        <h3>File Location:</h3>
        <code className={s.codeBlock}>
          @apps/(default)/views/test-nextjs/_route.js
        </code>

        <h3 className={s.heading}>Route Path:</h3>
        <code className={s.codeBlock}>/test-nextjs</code>

        <h3 className={s.heading}>Features Demonstrated:</h3>
        <ul>
          <li>✅ File-based routing (_route.js)</li>
          <li>✅ Route groups: (default) removed from URL</li>
          <li>✅ Metadata export (title, description)</li>
          <li>✅ Component export as default</li>
          <li>✅ Automatic Layout Wrapping (_layout.js)</li>
        </ul>
      </div>

      <div className={s.infoBox}>
        <h3>Next Steps:</h3>
        <ol>
          <li>Check browser console for discovery logs</li>
          <li>Test layout nesting with /test-nextjs/nested</li>
          <li>Verify old routes still work (/login, /about)</li>
        </ol>
      </div>
    </div>
  );
}
