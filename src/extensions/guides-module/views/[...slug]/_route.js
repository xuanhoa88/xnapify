/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { marked } from 'marked';

import MarkdownViewer from '../components/preview/MarkdownViewer';

// Configure marked with custom renderers here to avoid client/server mismatch
const renderer = new marked.Renderer();
const defaultCodeRenderer = renderer.code.bind(renderer);
renderer.code = function (code, language, isEscaped) {
  if (language === 'mermaid') {
    return `<div class="mermaid">${code}</div>`;
  }
  return defaultCodeRenderer(code, language, isEscaped);
};
renderer.blockquote = function (quote) {
  const match = quote.match(/^<p>\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i);
  if (match) {
    const type = match[1].toLowerCase();
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    const cleaned = quote.replace(
      /^<p>\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\](?:<br>|\n|\s*)?/i,
      '<p>',
    );

    // Hardcoded classes because CSS Modules aren't directly available here
    // but the global CSS injects these from MarkdownViewer.css
    return `<div class="MarkdownViewer_githubAlert MarkdownViewer_alert${typeCapitalized}">
              <div class="MarkdownViewer_alertTitle">${typeCapitalized}</div>
              <div class="MarkdownViewer_alertBody">${cleaned}</div>
            </div>`;
  }
  return `<blockquote>${quote}</blockquote>`;
};

marked.setOptions({ renderer });

/**
 * Strip YAML frontmatter from markdown content and extract the title.
 * @param {string} raw - Raw markdown string
 * @returns {{ content: string, title: string|null }}
 */
function parseFrontmatter(raw) {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { content: raw, title: null };

  const body = raw.slice(fm[0].length).trim();
  const titleMatch = fm[1].match(/^title:\s*(['"]?)(.+?)\1/m);
  return { content: body, title: titleMatch ? titleMatch[2] : null };
}

/**
 * Find the first file node in a sidebar tree using breadth-first search.
 * @param {Array} tree - Sidebar tree nodes
 * @returns {Object|null}
 */
function findFirstFile(tree) {
  const queue = [...tree];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.type === 'file') return node;
    if (node.type === 'directory' && node.children) {
      queue.push(...node.children);
    }
  }
  return null;
}

/**
 * Sanitize HTML via DOMPurify, with graceful fallback.
 * @param {string} html
 * @returns {Promise<string>}
 */
async function sanitize(html) {
  try {
    const { default: DOMPurify } = await import('isomorphic-dompurify');
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onclick'],
    });
  } catch (e) {
    // Fallback: deliver unsanitized HTML if ESM import fails on Node
    console.warn('DOMPurify bypass:', e.message);
    return html;
  }
}

export async function getInitialProps({ fetch, params }) {
  const slug = params && params.slug;
  const isIndex = !slug; // empty string or undefined → index page

  try {
    // Always fetch the sidebar tree
    const treeRes = await fetch('/api/guides');
    const tree = treeRes && treeRes.success && treeRes.data ? treeRes.data : [];

    // Index page: redirect to the first available document
    if (isIndex) {
      const first = findFirstFile(tree);
      if (first) {
        return { redirect: `/guides/${first.path}` };
      }
      return { error: true, htmlResult: '', title: null, tree };
    }

    // Document page: fetch the markdown source
    const pathPart = Array.isArray(slug) ? slug.join('/') : slug;
    const rawText = await fetch(
      `/api/extensions/${__EXTENSION_ID__}/static/assets/${pathPart}.md`,
      { headers: { 'Content-Type': 'text/markdown' } },
    );

    // Guard: static endpoint returned non-string (404 JSON, etc.)
    if (typeof rawText !== 'string') {
      return { error: true, htmlResult: '', title: null, tree };
    }

    // Parse frontmatter and render markdown
    const { content, title } = parseFrontmatter(rawText);
    const htmlResult = await sanitize(marked.parse(content));

    return { htmlResult, title, error: false, tree };
  } catch (err) {
    console.error('getInitialProps failed for docs:', err);
    return { error: true, htmlResult: '', title: null, tree: [] };
  }
}

export default MarkdownViewer;
