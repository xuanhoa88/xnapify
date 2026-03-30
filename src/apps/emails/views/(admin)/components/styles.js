/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Shared Tiptap Editor & Preview CSS
 *
 * This string contains the essential CSS rules to render Tiptap HTML content
 * correctly. It is injected into the <style> block of the Preview iframe
 * AND can be injected as a global stylesheet for the WYSIWYG editor to assure 1:1 parity.
 *
 * @type {string}
 */
export const TIPTAP_CORE_STYLES = `
/* ============================================================
   TIPTAP EDITOR CSS — matches email preview 1:1

   Two layers:
   1. SHARED TOKENS  — CSS variables used by both editor & preview
   2. EDITOR STYLES  — .ProseMirror in editable mode

   Usage:
     Import this file alongside your Tiptap setup.
     The editor content will look identical to the preview output.
   ============================================================ */

/* ── 1. SHARED DESIGN TOKENS ──────────────────────────────── */
:root {
  /* Typography */
  --tt-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif;
  --tt-font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
    "Courier New", monospace;
  --tt-font-size-base: 14px;
  --tt-line-height: 1.6;

  /* Colors */
  --tt-color-text:        #111827;
  --tt-color-muted:       #6b7280;
  --tt-color-border:      #d1d5db;
  --tt-color-border-light:#e5e7eb;
  --tt-color-bg:          #ffffff;
  --tt-color-bg-subtle:   #f9fafb;
  --tt-color-bg-code:     #f3f4f6;
  --tt-color-bg-pre:      #1e293b;
  --tt-color-link:        #2563eb;
  --tt-color-link-hover:  #1d4ed8;
  --tt-color-accent:      #3b82f6;

  /* Editor chrome */
  --tt-editor-bg:         #ffffff;
  --tt-editor-padding:    24px 20px;
  --tt-editor-max-width:  600px;
  --tt-editor-radius:     8px;
  --tt-editor-border:     1px solid #e5e7eb;

  /* Selection */
  --tt-selection-bg:      rgba(59, 130, 246, 0.15);
  --tt-cell-selected-bg:  rgba(59, 130, 246, 0.08);
}

/* ── 2. EDITOR SHELL ────────────────────────────────────────
   Wrap your <EditorContent> in .tiptap-editor-shell
   to get the bordered, padded card look.
   ─────────────────────────────────────────────────────────── */
.tiptap-editor-shell {
  background: var(--tt-editor-bg);
  border: var(--tt-editor-border);
  border-radius: var(--tt-editor-radius);
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  overflow: hidden;
  font-family: var(--tt-font-sans);
}

/* ── 3. PROSEMIRROR CONTENT AREA ────────────────────────────
   Mirrors the preview wrapper exactly so WYSIWYG is true.
   ─────────────────────────────────────────────────────────── */
.ProseMirror {
  box-sizing: border-box;
  max-width: var(--tt-editor-max-width);
  width: 100%;
  margin: 0 auto;
  padding: var(--tt-editor-padding);
  background: var(--tt-editor-bg);
  font-family: var(--tt-font-sans);
  font-size: var(--tt-font-size-base);
  line-height: var(--tt-line-height);
  color: var(--tt-color-text);
  word-break: break-word;
  overflow-wrap: break-word;
  outline: none;
  min-height: 240px;
  caret-color: var(--tt-color-accent);
  tab-size: 2;
}

/* Text selection highlight */
.ProseMirror ::selection {
  background: var(--tt-selection-bg);
}

/* ── 4. PLACEHOLDER ───────────────────────────────────────── */
.ProseMirror p.is-editor-empty:first-child::before,
.ProseMirror p.is-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
  font-style: normal;
}

/* ── 5. TYPOGRAPHY — identical to preview ─────────────────── */
.ProseMirror p {
  margin: 0 0 10px 0;
  line-height: var(--tt-line-height);
  min-height: 1em;
}

.ProseMirror > *:first-child { margin-top: 0; }
.ProseMirror > *:last-child  { margin-bottom: 0; }

.ProseMirror h1 { font-size: 28px; font-weight: 700; line-height: 1.2;  margin: 24px 0 10px; color: var(--tt-color-text); }
.ProseMirror h2 { font-size: 22px; font-weight: 700; line-height: 1.25; margin: 20px 0  8px; color: var(--tt-color-text); }
.ProseMirror h3 { font-size: 18px; font-weight: 600; line-height: 1.3;  margin: 18px 0  8px; color: var(--tt-color-text); }
.ProseMirror h4 { font-size: 16px; font-weight: 600; line-height: 1.3;  margin: 16px 0  6px; color: var(--tt-color-text); }
.ProseMirror h5 { font-size: 14px; font-weight: 600; line-height: 1.4;  margin: 14px 0  6px; color: var(--tt-color-text); }
.ProseMirror h6 { font-size: 13px; font-weight: 600; line-height: 1.4;  margin: 12px 0  4px; color: #374151; }

.ProseMirror strong { font-weight: 700; }
.ProseMirror em     { font-style: italic; }
.ProseMirror u      { text-decoration: underline; }
.ProseMirror s      { text-decoration: line-through; }
.ProseMirror sub    { vertical-align: sub;   font-size: 11px; }
.ProseMirror sup    { vertical-align: super; font-size: 11px; }

.ProseMirror mark {
  background-color: #fef08a;
  color: inherit;
  border-radius: 2px;
  padding: 0 2px;
}

/* ── 6. LINKS ─────────────────────────────────────────────── */
.ProseMirror a {
  color: var(--tt-color-link);
  text-decoration: underline;
  cursor: text; /* keep text cursor in editor; pointer on hover */
  word-break: break-all;
}
.ProseMirror a:hover {
  color: var(--tt-color-link-hover);
}

/* ── 7. BLOCKQUOTE ────────────────────────────────────────── */
.ProseMirror blockquote {
  margin: 14px 0;
  padding: 10px 16px;
  border-left: 4px solid var(--tt-color-border);
  background-color: var(--tt-color-bg-subtle);
  color: #4b5563;
  font-style: italic;
  border-radius: 0 4px 4px 0;
}
.ProseMirror blockquote p { margin: 0; }

/* ── 8. HORIZONTAL RULE ───────────────────────────────────── */
.ProseMirror hr {
  border: none;
  border-top: 2px solid var(--tt-color-border-light);
  margin: 20px 0;
  height: 0;
  /* Show selected state */
  cursor: default;
}
.ProseMirror hr.ProseMirror-selectednode {
  border-top-color: var(--tt-color-accent);
}

/* ── 9. LISTS ─────────────────────────────────────────────── */
.ProseMirror ul {
  list-style-type: disc;
  margin: 8px 0;
  padding-left: 24px;
}
.ProseMirror ol {
  list-style-type: decimal;
  margin: 8px 0;
  padding-left: 24px;
}
.ProseMirror li {
  margin-bottom: 4px;
  line-height: var(--tt-line-height);
}
.ProseMirror li p { margin: 0; }
.ProseMirror ul ul,
.ProseMirror ol ol,
.ProseMirror ul ol,
.ProseMirror ol ul { margin: 4px 0; }

/* ── 10. TASK LIST ────────────────────────────────────────── */
.ProseMirror ul[data-type="taskList"] {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}

.ProseMirror li[data-type="taskItem"] {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.ProseMirror li[data-type="taskItem"] > label {
  flex: 0 0 auto;
  margin-top: 3px;
  cursor: pointer; /* clickable in editor */
}

.ProseMirror li[data-type="taskItem"] > label input[type="checkbox"] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--tt-color-accent);
  cursor: pointer;
}

.ProseMirror li[data-type="taskItem"] > div {
  flex: 1;
  min-width: 0;
}
.ProseMirror li[data-type="taskItem"] > div > p { margin: 0; }

.ProseMirror li[data-type="taskItem"][data-checked="true"] > div {
  color: #9ca3af;
  text-decoration: line-through;
}

/* ── 11. INLINE CODE ──────────────────────────────────────── */
.ProseMirror code {
  background-color: var(--tt-color-bg-code);
  border: 1px solid var(--tt-color-border-light);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: var(--tt-font-mono);
  font-size: 12px;
  color: #dc2626;
  white-space: pre-wrap;
}

/* ── 12. CODE BLOCK ───────────────────────────────────────── */
.ProseMirror pre {
  background-color: var(--tt-color-bg-pre);
  border-radius: 6px;
  padding: 14px 16px;
  margin: 14px 0;
  overflow-x: auto;
  font-family: var(--tt-font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: #e2e8f0;
  position: relative;
}

.ProseMirror pre code {
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  font-size: inherit;
  color: inherit;
  white-space: pre;
}

/* Language label badge */
.ProseMirror pre[data-language]::before {
  content: attr(data-language);
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 10px;
  font-family: var(--tt-font-sans);
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  pointer-events: none;
}

/* Syntax tokens (Lowlight / highlight.js) */
.ProseMirror pre .hljs-comment,
.ProseMirror pre .hljs-quote        { color: #94a3b8; font-style: italic; }
.ProseMirror pre .hljs-keyword,
.ProseMirror pre .hljs-selector-tag { color: #93c5fd; }
.ProseMirror pre .hljs-string,
.ProseMirror pre .hljs-attr         { color: #86efac; }
.ProseMirror pre .hljs-number,
.ProseMirror pre .hljs-literal      { color: #fca5a5; }
.ProseMirror pre .hljs-function,
.ProseMirror pre .hljs-title        { color: #fde68a; }
.ProseMirror pre .hljs-built_in,
.ProseMirror pre .hljs-type         { color: #c4b5fd; }
.ProseMirror pre .hljs-variable,
.ProseMirror pre .hljs-name         { color: #f8fafc; }

/* ── 13. TABLE ────────────────────────────────────────────── */
.ProseMirror .tableWrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 16px 0;
}

.ProseMirror table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  overflow: hidden;
  /* No margin here — tableWrapper handles it */
  margin: 0;
}

.ProseMirror table td,
.ProseMirror table th {
  border: 1px solid var(--tt-color-border);
  padding: 8px 12px;
  vertical-align: top;
  min-width: 40px;
  word-break: break-word;
  box-sizing: border-box;
  position: relative;
}

.ProseMirror table th {
  font-weight: 600;
  text-align: left;
  background-color: var(--tt-color-bg-code); /* #f3f4f6 — matches preview */
  color: var(--tt-color-text);
}

.ProseMirror table td p,
.ProseMirror table th p { margin: 0; }

/* Selected cell — subtle blue tint */
.ProseMirror table .selectedCell {
  background-color: var(--tt-cell-selected-bg);
}
/* Remove the default ProseMirror ::after overlay */
.ProseMirror table .selectedCell::after {
  display: none;
}

/* Column resize handle */
.ProseMirror table .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--tt-color-accent);
  opacity: 0;
  cursor: col-resize;
  transition: opacity 0.15s;
  pointer-events: auto;
  z-index: 10;
}
.ProseMirror table td:hover .column-resize-handle,
.ProseMirror table th:hover .column-resize-handle {
  opacity: 0.6;
}
.ProseMirror table .column-resize-handle:hover,
.ProseMirror.resize-cursor .column-resize-handle {
  opacity: 1;
}

/* Resize cursor on the wrapper when dragging */
.ProseMirror.resize-cursor {
  cursor: col-resize;
}

/* ── 14. IMAGES ───────────────────────────────────────────── */
.ProseMirror img {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  margin: 12px auto;
  cursor: default;
  transition: box-shadow 0.15s, outline 0.15s;
}

.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid var(--tt-color-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59,130,246,.15);
}

.ProseMirror img[data-align="left"]   { margin-left: 0;    margin-right: auto; }
.ProseMirror img[data-align="right"]  { margin-left: auto; margin-right: 0; }
.ProseMirror img[data-align="center"] { margin-left: auto; margin-right: auto; }

/* ── 15. IFRAME / VIDEO EMBED ─────────────────────────────── */
.ProseMirror .iframe-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: 6px;
  margin: 14px 0;
  background: #000;
}
.ProseMirror .iframe-wrapper iframe {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  border: 0;
  border-radius: 6px;
}
.ProseMirror iframe {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  border: 0;
  border-radius: 6px;
  margin: 14px auto;
}

/* ── 16. MENTIONS ─────────────────────────────────────────── */
.ProseMirror span[data-type="mention"] {
  background-color: #eff6ff;
  border-radius: 4px;
  color: var(--tt-color-link);
  font-weight: 500;
  padding: 1px 4px;
  white-space: nowrap;
}

/* ── 17. TEXT ALIGN ───────────────────────────────────────── */
.ProseMirror [style*="text-align: left"]    { text-align: left; }
.ProseMirror [style*="text-align: center"]  { text-align: center; }
.ProseMirror [style*="text-align: right"]   { text-align: right; }
.ProseMirror [style*="text-align: justify"] { text-align: justify; }

/* ── 18. INDENT ───────────────────────────────────────────── */
.ProseMirror [data-indent="1"] { padding-left: 24px; }
.ProseMirror [data-indent="2"] { padding-left: 48px; }
.ProseMirror [data-indent="3"] { padding-left: 72px; }
.ProseMirror [data-indent="4"] { padding-left: 96px; }

/* ── 19. DETAILS / SUMMARY ────────────────────────────────── */
.ProseMirror details {
  border: 1px solid var(--tt-color-border-light);
  border-radius: 6px;
  margin: 12px 0;
  overflow: hidden;
}
.ProseMirror details summary {
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--tt-color-bg-subtle);
  user-select: none;
  list-style: none;
}
.ProseMirror details > div { padding: 10px 14px; }

/* ── 20. GAP CURSOR ───────────────────────────────────────── */
.ProseMirror .ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}
.ProseMirror .ProseMirror-gapcursor::after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 2px solid var(--tt-color-text);
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}
.ProseMirror.ProseMirror-focused .ProseMirror-gapcursor { display: block; }

@keyframes ProseMirror-cursor-blink {
  to { visibility: hidden; }
}

/* ── 21. DRAG HANDLE (if using tiptap DragHandle ext.) ───── */
.tiptap-drag-handle {
  position: absolute;
  left: -22px;
  top: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s;
  color: #9ca3af;
}
.ProseMirror:hover .tiptap-drag-handle { opacity: 1; }
.tiptap-drag-handle:active { cursor: grabbing; }

/* ── 22. DROP CURSOR ──────────────────────────────────────── */
.ProseMirror .ProseMirror-dropcursor {
  color: var(--tt-color-accent);
  border-color: var(--tt-color-accent);
}

/* ── 23. FOCUS RING on shell ──────────────────────────────── */
.tiptap-editor-shell:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}


/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 640px) {
  .ProseMirror {
    padding: 16px 14px;
    font-size: 14px;
  }
  .ProseMirror h1 { font-size: 22px; }
  .ProseMirror h2 { font-size: 18px; }
  .ProseMirror h3 { font-size: 16px; }
}

@media (max-width: 480px) {
  .ProseMirror {
    padding: 12px 10px;
  }
  .ProseMirror pre  { font-size: 11px; padding: 10px 12px; }
  .ProseMirror ul,
  .ProseMirror ol   { padding-left: 18px; }
}
`;
