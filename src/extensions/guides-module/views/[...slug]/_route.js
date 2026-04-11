/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import MarkdownViewer from '../viewer/MarkdownViewer';

export async function getInitialProps({ fetch, params }) {
  if (!params || !params.slug) {
    return { error: true };
  }

  const pathPart = Array.isArray(params.slug)
    ? params.slug.join('/')
    : params.slug;

  try {
    const rawText = await fetch(
      `/api/extensions/${__EXTENSION_ID__}/static/${pathPart}.md`,
      {
        headers: {
          'Content-Type': 'text/markdown',
        },
      },
    );

    // Lightweight Frontmatter Regex Parser (handles both LF and CRLF)
    let content = rawText;
    let title = null;
    const frontmatterMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatterMatch) {
      // Remove frontmatter from the readable content
      content = rawText.slice(frontmatterMatch[0].length).trim();

      // Look for title: "Something" or title: Something
      const titleMatch = frontmatterMatch[1].match(/^title:\s*(['"]?)(.+?)\1/m);
      if (titleMatch) {
        title = titleMatch[2];
      }
    }

    return { content, title, error: false };
  } catch (err) {
    console.error('getInitialProps Failed for docs:', err);
    return { error: true, content: '', title: null };
  }
}

export default MarkdownViewer;
