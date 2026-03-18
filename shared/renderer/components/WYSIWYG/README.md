# WYSIWYG

A standalone rich-text editor powered by [Tiptap](https://tiptap.dev/), providing a full-featured, extensible WYSIWYG editing experience with markdown round-trip support.

## Usage

```jsx
import { WYSIWYG } from '@shared/renderer/components/WYSIWYG';

<WYSIWYG
  value={content}
  onChange={setContent}
  placeholder="Write something…"
  markdown
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | — | HTML id attribute |
| `className` | `string` | — | Additional CSS class |
| `disabled` | `boolean` | `false` | Disable editing |
| `error` | `boolean` | `false` | Show error state styling |
| `markdown` | `boolean` | `true` | When `true`, `value`/`onChange` use markdown; when `false`, raw HTML |
| `placeholder` | `string` | — | Placeholder text |
| `value` | `string` | — | Content string (markdown or HTML) |
| `onChange` | `function` | — | Callback fired on content change |
| `onBlur` | `function` | — | Callback fired on editor blur |
| `onMentionQuery` | `(query: string) => Promise<string[]>` | — | Async callback to search for mentionable items |
| `addExtensions` | `array` | `[]` | Custom Tiptap extensions to add |
| `excludeExtensions` | `string[]` | `[]` | Extension names to exclude (e.g. `['youtube', 'video']`) |
| `editorProps` | `object` | — | Custom ProseMirror editorProps to merge |
| `toolbarAppend` | `function` | — | Render function `(editor) => ReactNode` for extra toolbar buttons |

## Imperative API

```jsx
const editorRef = useRef();
editorRef.current.focus();             // Focus the editor
editorRef.current.getEditor();         // Access underlying Tiptap instance
```

## Built-in Extensions

| Extension | Excludable Key | Description |
|-----------|----------------|-------------|
| StarterKit | — | Bold, italic, strike, headings, lists, blockquote, code, horizontal rule |
| Underline | `underline` | Underline formatting |
| Link | `link` | Hyperlinks with URL prompt |
| Image | `image` | Image embedding with URL prompt |
| Video | `video` | HTML5 video (`<video>`) |
| Audio | `audio` | HTML5 audio (`<audio>`) |
| YouTube | `youtube` | YouTube embed |
| Table | `table` | Full table editing (insert, delete rows/cols, merge/split cells) |
| TaskList | `taskList` | Checkbox task lists |
| CodeBlock (Lowlight) | `codeBlock` | Syntax-highlighted code blocks |
| Color + TextStyle | `color` | Text color picker |
| Highlight | `highlight` | Background color highlight |
| FontSize | `fontSize` | Custom font size (px) |
| Emoji | `emoji` | Emoticon shortcode auto-replace + picker |
| Mention | `mention` | `@mention` with async search |
| Mathematics | `mathematics` | LaTeX formula editing (inline `$...$`, block `$$...$$`) via KaTeX |
| Comment | `comment` | Inline comment threads |
| Details | `details` | Collapsible `<details>` blocks |
| DragHandle | — | Drag-to-reorder blocks |
| Selection | — | Multi-block selection |

## Toolbar

The toolbar renders below the editor content and includes grouped buttons for:

- **Text formatting** — Bold, Italic, Underline, Strikethrough
- **Block formatting** — Bullet list, Ordered list, Task list, Blockquote, Details
- **Table tools** — Insert/manage tables via popup
- **Color & Font** — Text color, highlight, font size input
- **Links & Media** — Link, Image, Video/Audio/YouTube, Emoji picker
- **Code & Math** — Code block (with language picker), Math (LaTeX), Horizontal rule
- **History** — Undo / Redo
- **Plugin slot** — `wysiwyg.toolbar` for plugin-injected buttons
- **View options** — Full-screen toggle

### Prompt Modal System

All URL/input prompts (link, image, video, audio, youtube, math) use an internal modal (`ToolbarPromptModal`) instead of `window.prompt`. Each prompt exposes a `PluginSlot` for customization:

| Slot Name | Purpose |
|-----------|---------|
| `wysiwyg.prompt.link` | Link URL input |
| `wysiwyg.prompt.image` | Image URL input |
| `wysiwyg.prompt.video` | Video URL input |
| `wysiwyg.prompt.audio` | Audio URL input |
| `wysiwyg.prompt.youtube` | YouTube URL input |
| `wysiwyg.prompt.math` | LaTeX expression input |

Plugins can register custom components (e.g., file uploaders) for any slot.

## Markdown Support

When `markdown={true}` (default), the component auto-converts between HTML and markdown using `markdownUtils.js`:

- **HTML → Markdown**: Turndown with custom rules for tables, code blocks, task lists, images, videos, audio, math, and mentions
- **Markdown → HTML**: marked with pre-processors for LaTeX (`$...$` / `$$...$$`), audio/video URLs, and mentions
- **Auto-detection**: If raw HTML is passed but `markdown={true}`, the component detects non-markdown content and passes it through unchanged

## Plugin Slots

| Slot Name | Location | Props |
|-----------|----------|-------|
| `wysiwyg.toolbar` | Toolbar | `editor` |
| `wysiwyg.bubbleMenu` | Bubble menu | `editor` |
| `wysiwyg.prompt.*` | Prompt modals | `editor`, `value`, `onChange` |

## File Structure

| File | Purpose |
|------|---------|
| `WYSIWYG.js` | Main component — editor setup, extensions, layout |
| `Toolbar.js` | Formatting toolbar with all button groups |
| `ToolbarButton.js` | Individual toolbar button component |
| `ToolbarIcon.js` | SVG icon definitions |
| `ToolbarPromptModal.js` | Context + hook + modal for URL/input prompts |
| `MediaActionsPopup.js` | Video/Audio/YouTube dropdown |
| `CodeBlockActionsPopup.js` | Code block language picker popup |
| `CodeBlockView.js` | Custom NodeView for syntax-highlighted code blocks |
| `ColorPickerPopup.js` | Color picker dropdown for text/highlight |
| `TableActionsPopup.js` | Table management popup |
| `EmojiPickerButton.js` | Emoji picker dropdown |
| `CommentActionsPopup.js` | Comment thread popup |
| `CommentExtension.js` | Tiptap mark extension for inline comments |
| `DetailsExtension.js` | Collapsible details extension |
| `EmojiExtension.js` | Emoticon auto-replace extension |
| `FontSizeExtension.js` | Custom font size extension |
| `MediaExtensions.js` | Video and Audio node extensions |
| `MentionList.js` | `@mention` suggestion dropdown |
| `markdownUtils.js` | HTML ↔ Markdown conversion utilities |
| `suggestion.js` | Mention suggestion plugin configuration |
| `constants.js` | Emoji dictionary and common emoji list |
