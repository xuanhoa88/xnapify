/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { marked } from 'marked';
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// marked configuration (Markdown → HTML)
// ---------------------------------------------------------------------------
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

// ---------------------------------------------------------------------------
// Turndown factory (HTML → Markdown)
// ---------------------------------------------------------------------------
// Returns a fresh, fully-configured TurndownService.
// Using a factory instead of a module-level singleton avoids shared mutable
// state across SSR requests and makes the configuration easier to test.
function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
  });

  // Keep HTML tags that have no Markdown equivalent, but be specific about
  // which divs to keep (see the tipTapWrappers rule below) instead of
  // blanket-keeping ALL divs, which would leak editor internals into output.
  td.keep([
    'u', // underline
    'details',
    'summary',
    'video',
    'audio',
    'iframe',
    'source',
    'youtube',
  ]);

  // ── Tiptap-specific wrapper divs ─────────────────────────────────────────
  // Only keep divs that are known Tiptap structural wrappers; all other divs
  // are unwrapped so their children are processed normally.
  const TIPTAP_DIV_CLASSES = new Set([
    'media-wrapper',
    'details-content',
    'resizable-media-handle',
  ]);

  td.addRule('tipTapWrapperDivs', {
    filter(node) {
      return (
        node.nodeName === 'DIV' &&
        Array.from(node.classList).some(c => TIPTAP_DIV_CLASSES.has(c))
      );
    },
    replacement(content) {
      return content;
    },
  });

  // ── YouTube videos ────────────────────────────────────────────────────────
  // Tiptap's youtube wrapper uses <div data-youtube-video><iframe src="..."></iframe></div>
  td.addRule('youtubeVideo', {
    filter(node) {
      return node.nodeName === 'DIV' && node.hasAttribute('data-youtube-video');
    },
    replacement(_content, node) {
      const iframe = node.querySelector('iframe');
      if (!iframe) return '';
      const src = iframe.getAttribute('src');
      if (!src) return '';

      const width = iframe.getAttribute('width');
      const height = iframe.getAttribute('height');
      const start = iframe.getAttribute('start');

      let html = `<youtube src="${src}"`;
      if (width) html += ` width="${width}"`;
      if (height) html += ` height="${height}"`;
      if (start) html += ` start="${start}"`;
      html += '></youtube>\n';
      return html;
    },
  });

  // ── Enhanced images — keep as raw HTML ─────────────────────────────────────
  // Data-URI images produce extremely long ![](data:...) strings that break
  // marked's parser on round-trip. Standard Markdown also drops width/height.
  td.addRule('enhancedImage', {
    filter(node) {
      if (node.nodeName !== 'IMG') return false;
      const src = node.getAttribute('src');
      if (!src) return false;

      // Preserve as HTML if it's base64 (to prevent marked explosion)
      if (src.startsWith('data:')) return true;

      // Preserve as HTML if it has custom dimensions
      if (node.hasAttribute('width') && node.getAttribute('width') !== 'auto')
        return true;
      if (node.hasAttribute('height') && node.getAttribute('height') !== 'auto')
        return true;

      return false;
    },
    replacement(_content, node) {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') || '';
      const title = node.getAttribute('title') || '';
      const width = node.getAttribute('width');
      const height = node.getAttribute('height');

      let html = `<img src="${src}" alt="${alt}"`;
      if (title) html += ` title="${title}"`;
      if (width && width !== 'auto') html += ` width="${width}"`;
      if (height && height !== 'auto') html += ` height="${height}"`;
      html += '>';
      return html;
    },
  });

  // ── Strikethrough ~~text~~ ───────────────────────────────────────────────
  td.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement(content) {
      return '~~' + content + '~~';
    },
  });

  // ── GFM Tables ───────────────────────────────────────────────────────────
  td.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement(content, node) {
      const cleaned = content.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');
      // Use nextElementSibling (not nextSibling) to skip text/comment nodes.
      const isLastCell = !node.nextElementSibling;
      return ' ' + cleaned + ' |' + (isLastCell ? '' : '');
    },
  });

  td.addRule('tableRow', {
    filter: 'tr',
    replacement(content, node) {
      let output = '|' + content + '\n';

      const isHeaderRow =
        node.parentNode.nodeName === 'THEAD' ||
        (node.parentNode.nodeName === 'TBODY' &&
          !node.previousElementSibling) ||
        (node.parentNode.nodeName === 'TABLE' && !node.previousElementSibling);

      if (isHeaderRow) {
        const cells = node.querySelectorAll('th, td');
        const separator = Array.from(cells)
          .map(() => ' --- ')
          .join('|');
        output += '|' + separator + '|\n';
      }

      return output;
    },
  });

  td.addRule('table', {
    filter: 'table',
    replacement(content) {
      return '\n\n' + content.trim() + '\n\n';
    },
  });

  // Remove <thead>, <tbody>, <tfoot> wrappers — just pass through content.
  td.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement(content) {
      return content;
    },
  });

  // ── Task lists (Tiptap-specific HTML structure) ──────────────────────────
  td.addRule('taskListItem', {
    filter(node) {
      return (
        node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem'
      );
    },
    replacement(content, node) {
      const isChecked = node.getAttribute('data-checked') === 'true';
      // Strip leading newlines that Turndown sometimes adds inside list items.
      const cleaned = content.trim().replace(/^\n+/, '');
      return '- [' + (isChecked ? 'x' : ' ') + '] ' + cleaned + '\n';
    },
  });

  td.addRule('taskList', {
    filter(node) {
      return (
        node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList'
      );
    },
    replacement(content) {
      return '\n' + content + '\n';
    },
  });

  return td;
}

// Create a single shared instance for normal (non-SSR) use.
// In SSR environments, call createTurndownService() per-request instead.
const turndownService = createTurndownService();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rewrite marked's GFM task-list HTML into Tiptap's expected structure.
 *
 * marked outputs:
 *   <ul>
 *     <li><input checked="" disabled="" type="checkbox"> Text</li>
 *   </ul>
 *
 * Tiptap expects:
 *   <ul data-type="taskList">
 *     <li data-type="taskItem" data-checked="true"><p>Text</p></li>
 *   </ul>
 *
 * Attribute order is NOT guaranteed, so we match on type="checkbox" regardless
 * of where checked/disabled appear.
 *
 * We also only wrap item content in <p> when it is plain inline content.
 * If the item already contains block-level tags we leave the content as-is to
 * avoid generating invalid HTML.
 */
const BLOCK_TAGS = /^<(p|ul|ol|li|blockquote|pre|div|h[1-6])/i;

function rewriteTaskLists(html) {
  // Match a <ul> that contains at least one checkbox input.
  return html.replace(/<ul>([\s\S]*?)<\/ul>/g, (ulMatch, inner) => {
    // Only process if this <ul> actually has task items.
    if (!/<li><input\b[^>]*type="checkbox"[^>]*>/i.test(inner)) {
      return ulMatch;
    }

    const rewrittenInner = inner.replace(
      /<li><input\b([^>]*)type="checkbox"([^>]*)>([\s\S]*?)<\/li>/gi,
      (_liMatch, before, after, content) => {
        const attrs = before + after;
        // checked attribute can appear before OR after type, in any form:
        // checked, checked="", checked="checked"
        const isChecked = /\bchecked\b/i.test(attrs);
        const trimmed = content.trim();
        // Only wrap in <p> for inline-only content to avoid invalid nesting.
        const wrapped = BLOCK_TAGS.test(trimmed)
          ? trimmed
          : '<p>' + trimmed + '</p>';
        return (
          '<li data-type="taskItem" data-checked="' +
          isChecked +
          '">' +
          wrapped +
          '</li>'
        );
      },
    );

    return '<ul data-type="taskList">' + rewrittenInner + '</ul>';
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an HTML string to Markdown.
 *
 * @param {string} html - Raw HTML, typically from a Tiptap editor.
 * @param {TurndownService} [service] - Optional custom TurndownService instance
 *   (useful in SSR environments where you want per-request isolation).
 * @returns {string} Markdown string.
 */
export function htmlToMarkdown(html, service = turndownService) {
  if (!html || typeof html !== 'string') return '';
  return service.turndown(html);
}

/**
 * Convert a Markdown string to HTML compatible with Tiptap's schema.
 *
 * Post-processes marked's output to:
 *  - Rewrite GFM task-list `<input type="checkbox">` items into Tiptap's
 *    `data-type="taskItem"` structure.
 *
 * @param {string} markdown - Markdown input string.
 * @returns {string} HTML string ready for Tiptap's `setContent()`.
 */
export function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  // Pre-process: Convert any ![alt](data:image/...) markdown images to raw
  // <img> tags BEFORE passing to marked, because marked may fail to parse
  // very long data URIs inside the image syntax.
  let processed = markdown.replace(
    /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g,
    '<img src="$2" alt="$1">',
  );

  let html = marked.parse(processed);

  // Post-process: marked incorrectly wraps block-level raw HTML elements (like audio, video)
  // inside <p> tags. This makes Tiptap split the invalid <p> into floating empty paragraphs.
  html = html.replace(
    /<p>\s*(<(?:audio|video|iframe|youtube|details)[\s\S]*?>[\s\S]*?<\/(?:audio|video|iframe|youtube|details)>|<(?:audio|video|iframe|youtube|source)[^>]*>)\s*<\/p>/gi,
    '$1',
  );

  // Post-process: Convert custom <youtube> tags back into Tiptap's expected iframe wrapper
  html = html.replace(
    /<youtube\s([^>]*)>(.*?<\/youtube>)?/gi,
    '<div data-youtube-video><iframe $1></iframe></div>',
  );

  // Post-process: Tiptap's Image extension uses inline: true, so ProseMirror
  // silently drops <img> tags that aren't inside a block parent like <p>.
  // Wrap any standalone <img> tags (not already inside <p>) in <p> tags.
  html = html.replace(/^(<img\s[^>]*>)$/gm, '<p>$1</p>');

  return rewriteTaskLists(html);
}

/**
 * Create an isolated TurndownService instance with all rules pre-applied.
 * Use this in SSR/Edge environments instead of the module-level singleton.
 *
 * @returns {TurndownService}
 */
export { createTurndownService };
